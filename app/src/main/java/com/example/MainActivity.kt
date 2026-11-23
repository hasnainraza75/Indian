package com.example

import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.ActivityInfo
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.webkit.ConsoleMessage
import android.webkit.JavascriptInterface
import android.webkit.MimeTypeMap
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.enableEdgeToEdge
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import java.io.ByteArrayInputStream
import java.io.IOException

class MainActivity : ComponentActivity() {

  private lateinit var webView: WebView
  private val assetOrigin = "https://appassets.androidplatform.net"

  @SuppressLint("SetJavaScriptEnabled")
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    enableEdgeToEdge()
    window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    applyImmersiveMode()

    webView = WebView(this).apply {
      layoutParams = ViewGroup.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT,
        ViewGroup.LayoutParams.MATCH_PARENT
      )
      setBackgroundColor(Color.parseColor("#090D16"))
      overScrollMode = View.OVER_SCROLL_NEVER
      isHorizontalScrollBarEnabled = false
      isVerticalScrollBarEnabled = false
      isHapticFeedbackEnabled = false

      settings.apply {
        javaScriptEnabled = true
        domStorageEnabled = true
        databaseEnabled = true
        mediaPlaybackRequiresUserGesture = false
        useWideViewPort = true
        loadWithOverviewMode = true
        setSupportZoom(false)
        builtInZoomControls = false
        displayZoomControls = false
        allowFileAccess = false
        allowContentAccess = false
        cacheMode = WebSettings.LOAD_DEFAULT
      }

      addJavascriptInterface(AndroidGameBridge(this@MainActivity), "AndroidNativeBridge")

      webChromeClient = object : WebChromeClient() {
        override fun onConsoleMessage(consoleMessage: ConsoleMessage?): Boolean {
          return true
        }
      }

      webViewClient = object : WebViewClient() {
        override fun shouldInterceptRequest(
          view: WebView,
          request: WebResourceRequest
        ): WebResourceResponse? {
          val url = request.url ?: return null
          if (url.host == "appassets.androidplatform.net") {
            val rawPath = url.path?.trimStart('/') ?: "assets/public/index.html"
            val assetPath = if (rawPath.startsWith("assets/")) {
              rawPath.removePrefix("assets/")
            } else {
              "public/$rawPath"
            }
            val cleanPath = if (assetPath.isEmpty() || assetPath.endsWith("/")) {
              "${assetPath}index.html"
            } else {
              assetPath
            }
            return try {
              val stream = assets.open(cleanPath)
              WebResourceResponse(guessMimeType(cleanPath), "UTF-8", stream)
            } catch (_: IOException) {
              WebResourceResponse(
                "text/plain",
                "UTF-8",
                404,
                "Not Found",
                emptyMap(),
                ByteArrayInputStream(ByteArray(0))
              )
            }
          }
          return super.shouldInterceptRequest(view, request)
        }
      }
    }

    setContentView(webView)

    onBackPressedDispatcher.addCallback(
      this,
      object : OnBackPressedCallback(true) {
        override fun handleOnBackPressed() {
          webView.evaluateJavascript(
            "window.__handleAndroidBack ? window.__handleAndroidBack() : false"
          ) { result ->
            if (result != "true") {
              // Handled in JS or ignored unless explicit exit
            }
          }
        }
      }
    )

    if (savedInstanceState != null) {
      webView.restoreState(savedInstanceState)
    } else {
      webView.loadUrl("$assetOrigin/assets/public/index.html")
    }
  }

  private fun guessMimeType(path: String): String {
    return when {
      path.endsWith(".html") -> "text/html"
      path.endsWith(".js") || path.endsWith(".mjs") -> "application/javascript"
      path.endsWith(".css") -> "text/css"
      path.endsWith(".json") -> "application/json"
      path.endsWith(".svg") -> "image/svg+xml"
      path.endsWith(".png") -> "image/png"
      path.endsWith(".jpg") || path.endsWith(".jpeg") -> "image/jpeg"
      path.endsWith(".webp") -> "image/webp"
      path.endsWith(".woff2") -> "font/woff2"
      path.endsWith(".wasm") -> "application/wasm"
      else -> {
        val ext = MimeTypeMap.getFileExtensionFromUrl(path)
        MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext) ?: "application/octet-stream"
      }
    }
  }

  private fun applyImmersiveMode() {
    WindowCompat.setDecorFitsSystemWindows(window, false)
    val controller = WindowInsetsControllerCompat(window, window.decorView)
    controller.systemBarsBehavior =
      WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
    controller.hide(WindowInsetsCompat.Type.systemBars())
  }

  override fun onWindowFocusChanged(hasFocus: Boolean) {
    super.onWindowFocusChanged(hasFocus)
    if (hasFocus) {
      applyImmersiveMode()
    }
  }

  override fun onPause() {
    super.onPause()
    if (::webView.isInitialized) {
      webView.evaluateJavascript(
        "window.dispatchEvent(new CustomEvent('android-lifecycle', { detail: { state: 'pause' } }))",
        null
      )
      webView.onPause()
    }
  }

  override fun onResume() {
    super.onResume()
    applyImmersiveMode()
    if (::webView.isInitialized) {
      webView.onResume()
      webView.evaluateJavascript(
        "window.dispatchEvent(new CustomEvent('android-lifecycle', { detail: { state: 'resume' } }))",
        null
      )
    }
  }

  override fun onSaveInstanceState(outState: Bundle) {
    super.onSaveInstanceState(outState)
    if (::webView.isInitialized) {
      webView.saveState(outState)
    }
  }

  override fun onDestroy() {
    if (::webView.isInitialized) {
      webView.destroy()
    }
    super.onDestroy()
  }

  inner class AndroidGameBridge(private val activity: MainActivity) {
    private val prefs = activity.getSharedPreferences("indian_open_world_3d_prefs", Context.MODE_PRIVATE)

    @JavascriptInterface
    fun saveData(slot: String, json: String): Boolean {
      return prefs.edit().putString(slot, json).commit()
    }

    @JavascriptInterface
    fun loadData(slot: String): String {
      return prefs.getString(slot, "") ?: ""
    }

    @JavascriptInterface
    fun removeData(slot: String): Boolean {
      return prefs.edit().remove(slot).commit()
    }

    @JavascriptInterface
    fun vibrate(durationMs: Long) {
      try {
        val clamped = durationMs.coerceIn(10L, 400L)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
          val manager = activity.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
          manager?.defaultVibrator?.vibrate(
            VibrationEffect.createOneShot(clamped, VibrationEffect.DEFAULT_AMPLITUDE)
          )
        } else {
          @Suppress("DEPRECATION")
          val vibrator = activity.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
          if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            vibrator?.vibrate(
              VibrationEffect.createOneShot(clamped, VibrationEffect.DEFAULT_AMPLITUDE)
            )
          } else {
            @Suppress("DEPRECATION")
            vibrator?.vibrate(clamped)
          }
        }
      } catch (_: Exception) {
        // Ignore on devices without vibrator
      }
    }

    @JavascriptInterface
    fun setOrientationMode(mode: String) {
      activity.runOnUiThread {
        activity.requestedOrientation = when (mode) {
          "auto" -> ActivityInfo.SCREEN_ORIENTATION_FULL_SENSOR
          "portrait" -> ActivityInfo.SCREEN_ORIENTATION_SENSOR_PORTRAIT
          else -> ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
        }
      }
    }

    @JavascriptInterface
    fun exitApp() {
      activity.runOnUiThread {
        activity.finish()
      }
    }
  }
}
