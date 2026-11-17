import ExpoModulesCore
import UIKit
import Vision
import CoreImage
import CoreVideo
import SDWebImageWebPCoder

private struct PackPayload: Decodable {
  struct Sticker: Decodable { let uri: String; let caption: String }
  let id: String
  let name: String
  let publisher: String
  let trayUri: String
  let stickers: [Sticker]
}

public class FanStickersModule: Module {
  public func definition() -> ModuleDefinition {
    Name("FanStickers")

    AsyncFunction("removeBackground") { (uri: String) throws -> String in
      let url = try self.localURL(uri)
      guard let image = CIImage(contentsOf: url) else { throw self.error("This image could not be read.") }
      let request = VNGeneratePersonSegmentationRequest()
      request.qualityLevel = .accurate
      request.outputPixelFormat = kCVPixelFormatType_OneComponent8
      try VNImageRequestHandler(ciImage: image, options: [:]).perform([request])
      guard let buffer = request.results?.first?.pixelBuffer else { throw self.error("No clear person found. Try a closer photo.") }
      CVPixelBufferLockBaseAddress(buffer, .readOnly)
      let stride = CVPixelBufferGetBytesPerRow(buffer)
      let width = CVPixelBufferGetWidth(buffer)
      let height = CVPixelBufferGetHeight(buffer)
      var foreground = false
      if let base = CVPixelBufferGetBaseAddress(buffer)?.assumingMemoryBound(to: UInt8.self) {
        for y in Swift.stride(from: 0, to: height, by: 4) {
          for x in Swift.stride(from: 0, to: width, by: 4) where base[y * stride + x] > 128 { foreground = true }
        }
      }
      CVPixelBufferUnlockBaseAddress(buffer, .readOnly)
      guard foreground else { throw self.error("No clear person found. Try a closer photo.") }
      let rawMask = CIImage(cvPixelBuffer: buffer)
      let mask = rawMask.transformed(by: CGAffineTransform(scaleX: image.extent.width / rawMask.extent.width, y: image.extent.height / rawMask.extent.height))
      let clear = CIImage(color: CIColor(red: 0, green: 0, blue: 0, alpha: 0)).cropped(to: image.extent)
      let result = image.applyingFilter("CIBlendWithMask", parameters: [kCIInputBackgroundImageKey: clear, kCIInputMaskImageKey: mask])
      guard let cg = CIContext().createCGImage(result, from: image.extent), let data = UIImage(cgImage: cg).pngData() else { throw self.error("Could not create the cutout.") }
      let output = FileManager.default.temporaryDirectory.appendingPathComponent("cutout-\(UUID().uuidString).png")
      try data.write(to: output, options: .atomic)
      return output.absoluteString
    }

    AsyncFunction("exportPack") { (payload: String) async throws -> Bool in
      let pack = try JSONDecoder().decode(PackPayload.self, from: Data(payload.utf8))
      guard pack.id.range(of: "^[a-zA-Z0-9-]{1,120}$", options: .regularExpression) != nil,
        (1...128).contains(pack.name.count), (1...128).contains(pack.publisher.count), (3...30).contains(pack.stickers.count)
        else { throw self.error("A WhatsApp pack needs a name and 3–30 stickers.") }
      let tray = try Data(contentsOf: self.localURL(pack.trayUri))
      try self.validate(tray, dimension: 96, maxBytes: 50 * 1024, webp: false)
      var stickers: [[String: Any]] = []
      for sticker in pack.stickers {
        let data = try Data(contentsOf: self.localURL(sticker.uri))
        try self.validate(data, dimension: 512, maxBytes: 100 * 1024, webp: true)
        stickers.append(["image_data": data.base64EncodedString(), "emojis": [], "accessibility_text": String(sticker.caption.prefix(125))])
      }
      let data = try JSONSerialization.data(withJSONObject: ["identifier": pack.id, "name": pack.name, "publisher": pack.publisher, "tray_image": tray.base64EncodedString(), "stickers": stickers])
      return await withCheckedContinuation { continuation in
        DispatchQueue.main.async {
          guard let url = URL(string: "whatsapp://stickerPack"), UIApplication.shared.canOpenURL(url) else { continuation.resume(returning: false); return }
          UIPasteboard.general.setItems([["net.whatsapp.third-party.sticker-pack": data]], options: [.localOnly: true, .expirationDate: Date().addingTimeInterval(60)])
          UIApplication.shared.open(url, options: [:]) { opened in continuation.resume(returning: opened) }
        }
      }
    }
  }

  private func error(_ message: String) -> NSError { NSError(domain: "BiasStudio", code: 1, userInfo: [NSLocalizedDescriptionKey: message]) }
  private func localURL(_ uri: String) throws -> URL {
    guard let url = URL(string: uri), url.isFileURL else { throw error("Only local images can be exported.") }
    let resolved = url.resolvingSymlinksInPath().standardizedFileURL
    let home = URL(fileURLWithPath: NSHomeDirectory()).resolvingSymlinksInPath().path + "/"
    guard resolved.path.hasPrefix(home), FileManager.default.fileExists(atPath: resolved.path) else { throw error("This sticker is missing. Create it again.") }
    return resolved
  }
  private func validate(_ data: Data, dimension: Int, maxBytes: Int, webp: Bool) throws {
    guard !data.isEmpty, data.count <= maxBytes else { throw error("Sticker or tray image exceeds WhatsApp’s size limit.") }
    let image: UIImage?
    if webp {
      guard data.count > 12, String(data: data.prefix(4), encoding: .ascii) == "RIFF", String(data: data[8..<12], encoding: .ascii) == "WEBP" else { throw error("The sticker must be WebP.") }
      image = SDImageWebPCoder.shared.decodedImage(with: data, options: nil)
    } else {
      guard data.starts(with: [137, 80, 78, 71, 13, 10, 26, 10]) else { throw error("The tray icon must be PNG.") }
      image = UIImage(data: data)
    }
    guard let cg = image?.cgImage, cg.width == dimension, cg.height == dimension else { throw error("Sticker or tray image has invalid dimensions.") }
  }
}
