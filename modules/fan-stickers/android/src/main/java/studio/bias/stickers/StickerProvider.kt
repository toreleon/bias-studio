package studio.bias.stickers

import android.content.ContentProvider
import android.content.ContentValues
import android.content.res.AssetFileDescriptor
import android.database.Cursor
import android.database.MatrixCursor
import android.net.Uri
import android.os.ParcelFileDescriptor
import org.json.JSONObject
import java.io.File
import java.io.FileNotFoundException

/** Only exposes published sticker snapshots, never the user's source photos. */
class StickerProvider : ContentProvider() {
  override fun onCreate() = true
  private val root: File get() = File(requireNotNull(context).filesDir, "whatsapp-packs")
  private fun safeId(id: String) = id.matches(Regex("[a-zA-Z0-9-]{1,120}"))
  private fun pack(id: String): JSONObject? {
    if (!safeId(id)) return null
    val file = File(File(root, id), "pack.json")
    return if (file.isFile) runCatching { JSONObject(file.readText()) }.getOrNull() else null
  }

  override fun query(uri: Uri, projection: Array<out String>?, selection: String?, selectionArgs: Array<out String>?, sortOrder: String?): Cursor {
    val path = uri.pathSegments
    require(path.size in 1..2) { "Unknown sticker query." }
    if (path[0] == "metadata") {
      val columns = arrayOf("sticker_pack_identifier", "sticker_pack_name", "sticker_pack_publisher", "sticker_pack_icon", "android_play_store_link", "ios_app_download_link", "sticker_pack_publisher_email", "sticker_pack_publisher_website", "sticker_pack_privacy_policy_website", "sticker_pack_license_agreement_website", "image_data_version", "whatsapp_will_not_cache_stickers", "animated_sticker_pack")
      val cursor = MatrixCursor(columns)
      val packs = if (path.size == 2) listOfNotNull(pack(path[1])) else root.listFiles()?.filter { !it.name.startsWith("stage-") }?.mapNotNull { pack(it.name) } ?: emptyList()
      for (item in packs) cursor.addRow(arrayOf(item.getString("id"), item.getString("name"), item.getString("publisher"), "tray.png", "", "", "", "", "", "", item.getString("version"), 0, 0))
      cursor.setNotificationUri(requireNotNull(context).contentResolver, uri)
      return cursor
    }
    if (path[0] == "stickers" && path.size == 2) {
      val cursor = MatrixCursor(arrayOf("sticker_file_name", "sticker_emoji", "sticker_accessibility_text"))
      val stickers = pack(path[1])?.getJSONArray("stickers")
      if (stickers != null) for (i in 0 until stickers.length()) {
        val sticker = stickers.getJSONObject(i)
        cursor.addRow(arrayOf(sticker.getString("file"), "", sticker.optString("caption")))
      }
      cursor.setNotificationUri(requireNotNull(context).contentResolver, uri)
      return cursor
    }
    throw IllegalArgumentException("Unknown sticker query.")
  }

  override fun openAssetFile(uri: Uri, mode: String): AssetFileDescriptor {
    if (mode != "r") throw FileNotFoundException("Read only.")
    val path = uri.pathSegments
    if (path.size != 3 || path[0] != "stickers_asset") throw FileNotFoundException()
    val metadata = pack(path[1]) ?: throw FileNotFoundException()
    val name = path[2]
    val stickers = metadata.getJSONArray("stickers")
    val allowed = name == "tray.png" || (0 until stickers.length()).any { stickers.getJSONObject(it).getString("file") == name }
    if (!allowed || name.contains('/') || name.contains('\\')) throw FileNotFoundException()
    val file = File(File(root, path[1]), name)
    return AssetFileDescriptor(ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY), 0, file.length())
  }
  override fun getType(uri: Uri): String {
    val path = uri.pathSegments
    return when (path.firstOrNull()) {
      "metadata" -> "vnd.android.cursor.${if (path.size == 1) "dir" else "item"}/vnd.${uri.authority}.metadata"
      "stickers" -> "vnd.android.cursor.dir/vnd.${uri.authority}.stickers"
      "stickers_asset" -> if (path.lastOrNull() == "tray.png") "image/png" else "image/webp"
      else -> throw IllegalArgumentException("Unknown sticker URI.")
    }
  }
  override fun insert(uri: Uri, values: ContentValues?): Uri? = throw UnsupportedOperationException("Read only.")
  override fun delete(uri: Uri, selection: String?, selectionArgs: Array<out String>?): Int = throw UnsupportedOperationException("Read only.")
  override fun update(uri: Uri, values: ContentValues?, selection: String?, selectionArgs: Array<out String>?): Int = throw UnsupportedOperationException("Read only.")
}
