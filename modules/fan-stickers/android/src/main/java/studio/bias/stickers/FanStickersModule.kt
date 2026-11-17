package studio.bias.stickers

import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.segmentation.Segmentation
import com.google.mlkit.vision.segmentation.selfie.SelfieSegmenterOptions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.util.UUID
import java.util.concurrent.Executors

class FanStickersModule : Module() {
  private val imageExecutor = Executors.newSingleThreadExecutor()
  override fun definition() = ModuleDefinition {
    Name("FanStickers")
    OnDestroy { imageExecutor.shutdown() }

    AsyncFunction("removeBackground") { uri: String, promise: Promise ->
      try {
        val context = requireNotNull(appContext.reactContext)
        val source = localFile(uri)
        val bitmap = requireNotNull(BitmapFactory.decodeFile(source.path)) { "Could not read this image." }
        val segmenter = Segmentation.getClient(SelfieSegmenterOptions.Builder()
          .setDetectorMode(SelfieSegmenterOptions.SINGLE_IMAGE_MODE).build())
        segmenter.process(InputImage.fromBitmap(bitmap, 0))
          .addOnSuccessListener(imageExecutor) { mask ->
            // ML Kit returns a full-resolution confidence mask unless raw-size masks are enabled.
            try {
              val pixels = IntArray(bitmap.width * bitmap.height)
              bitmap.getPixels(pixels, 0, bitmap.width, 0, 0, bitmap.width, bitmap.height)
              val confidence = mask.buffer
              confidence.rewind()
              require(mask.width == bitmap.width && mask.height == bitmap.height) { "Cutout mask size did not match the image." }
              var foreground = 0
              for (i in pixels.indices) {
                val probability = confidence.float.coerceIn(0f, 1f)
                if (probability > 0.5f) foreground++
                val alpha = (probability * 255).toInt()
                pixels[i] = (pixels[i] and 0x00ffffff) or (alpha shl 24)
              }
              require(foreground > pixels.size / 1000) { "No clear person found. Try a closer photo." }
              val output = Bitmap.createBitmap(pixels, bitmap.width, bitmap.height, Bitmap.Config.ARGB_8888)
              val file = File(context.cacheDir, "cutout-${UUID.randomUUID()}.png")
              file.outputStream().use { output.compress(Bitmap.CompressFormat.PNG, 100, it) }
              output.recycle()
              promise.resolve(Uri.fromFile(file).toString())
            } catch (e: Exception) { promise.reject("CUTOUT_FAILED", e.message, e) }
            finally { bitmap.recycle(); segmenter.close() }
          }
          .addOnFailureListener(imageExecutor) { e -> bitmap.recycle(); segmenter.close(); promise.reject("CUTOUT_FAILED", "Could not remove the background. Try a closer photo with one person.", e) }
      } catch (e: Exception) { promise.reject("CUTOUT_FAILED", e.message, e) }
    }

    AsyncFunction("exportPack") { payload: String ->
      val context = requireNotNull(appContext.reactContext)
      val pack = JSONObject(payload)
      val id = pack.getString("id")
      require(id.matches(Regex("[a-zA-Z0-9-]{1,120}"))) { "Invalid pack identifier." }
      require(pack.getString("name").length in 1..128) { "Invalid pack name." }
      require(pack.getString("publisher").length in 1..128) { "Invalid publisher." }
      val stickers = pack.getJSONArray("stickers")
      require(stickers.length() in 3..30) { "A WhatsApp pack needs 3–30 stickers." }
      val root = File(context.filesDir, "whatsapp-packs").apply { mkdirs() }
      // Immutable revision directories prevent WhatsApp reading a partly updated pack.
      val destination = File(root, id)
      if (!File(destination, "pack.json").isFile) {
        val staging = File(root, "stage-${UUID.randomUUID()}").apply { mkdirs() }
        try {
          val tray = localFile(pack.getString("trayUri"))
          validateImage(tray, 96, 50 * 1024, false)
          tray.copyTo(File(staging, "tray.png"), true)
          val items = JSONArray()
          for (i in 0 until stickers.length()) {
            val item = stickers.getJSONObject(i)
            val image = localFile(item.getString("uri"))
            validateImage(image, 512, 100 * 1024, true)
            val filename = "$i.webp"
            image.copyTo(File(staging, filename), true)
            items.put(JSONObject().put("file", filename).put("caption", item.optString("caption").take(125)))
          }
          val metadata = JSONObject().put("id", id).put("name", pack.getString("name"))
            .put("publisher", pack.getString("publisher")).put("version", id).put("stickers", items)
          File(staging, "pack.json").writeText(metadata.toString())
          require(staging.renameTo(destination)) { "Could not prepare the pack. Try again." }
        } finally { if (staging.exists()) staging.deleteRecursively() }
      }
      val intent = Intent("com.whatsapp.intent.action.ENABLE_STICKER_PACK")
        .putExtra("sticker_pack_id", id)
        .putExtra("sticker_pack_authority", context.packageName + ".stickers")
        .putExtra("sticker_pack_name", pack.getString("name"))
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      if (intent.resolveActivity(context.packageManager) == null) false
      else { context.startActivity(intent); true }
    }
  }

  private fun localFile(uri: String): File {
    val context = requireNotNull(appContext.reactContext)
    val parsed = Uri.parse(uri)
    require(parsed.scheme == "file") { "Only local images can be exported." }
    val file = File(requireNotNull(parsed.path)).canonicalFile
    require(listOf(context.filesDir, context.cacheDir).any { file.path.startsWith(it.canonicalPath + File.separator) }) { "Image is outside app storage." }
    require(file.isFile) { "This sticker is missing. Create it again." }
    return file
  }

  private fun validateImage(file: File, dimension: Int, maxBytes: Int, webp: Boolean) {
    require(file.length() in 1..maxBytes.toLong()) { "Sticker or tray image exceeds WhatsApp's size limit." }
    val options = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeFile(file.path, options)
    require(options.outWidth == dimension && options.outHeight == dimension) { "Sticker or tray image has invalid dimensions." }
    require(options.outMimeType == if (webp) "image/webp" else "image/png") { "Sticker or tray image has invalid encoding." }
  }
}
