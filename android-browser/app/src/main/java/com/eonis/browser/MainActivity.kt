package com.eonis.browser

import android.app.Activity
import android.app.AlertDialog
import android.app.DownloadManager
import android.content.Context
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Bundle
import android.os.Environment
import android.view.Gravity
import android.view.KeyEvent
import android.view.View
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputMethodManager
import android.webkit.CookieManager
import android.webkit.DownloadListener
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import java.net.URLEncoder

class MainActivity : Activity() {
    private val navy = Color.rgb(8, 15, 29)
    private val panel = Color.rgb(17, 28, 47)
    private val panel2 = Color.rgb(25, 40, 63)
    private val mint = Color.rgb(133, 231, 207)
    private val white = Color.rgb(240, 245, 252)
    private val muted = Color.rgb(153, 169, 191)

    private lateinit var root: LinearLayout
    private lateinit var address: EditText
    private lateinit var progress: ProgressBar
    private lateinit var webHost: FrameLayout
    private lateinit var home: LinearLayout
    private lateinit var tabLabel: TextView
    private val tabs = mutableListOf<WebView>()
    private val history = mutableListOf<Pair<String, String>>()
    private val bookmarks = mutableListOf<Pair<String, String>>()
    private var active = 0
    private var privateMode = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.statusBarColor = navy
        window.navigationBarColor = navy
        window.decorView.systemUiVisibility = 0
        buildUi()
        createTab(showHome = true)
    }

    private fun buildUi() {
        root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(14), dp(8), dp(14), dp(8))
            setBackgroundColor(navy)
        }
        setContentView(root)

        val brandRow = LinearLayout(this).apply {
            gravity = Gravity.CENTER_VERTICAL
            orientation = LinearLayout.HORIZONTAL
        }
        val brand = TextView(this).apply {
            text = "E O N I S"
            textSize = 18f
            letterSpacing = 0.16f
            setTextColor(white)
            typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
        }
        brandRow.addView(brand, LinearLayout.LayoutParams(0, dp(42), 1f))
        tabLabel = TextView(this).apply {
            text = "1 TAB"
            textSize = 11f
            letterSpacing = 0.08f
            setTextColor(mint)
            gravity = Gravity.CENTER
            background = rounded(panel2, 18)
            setPadding(dp(13), 0, dp(13), 0)
            setOnClickListener { showTabs() }
        }
        brandRow.addView(tabLabel, LinearLayout.LayoutParams(-2, dp(32)))
        root.addView(brandRow)

        val addressRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            background = rounded(panel, 20)
            setPadding(dp(12), 0, dp(6), 0)
        }
        address = EditText(this).apply {
            hint = "Search or enter address"
            textSize = 14f
            singleLine = true
            setTextColor(white)
            setHintTextColor(muted)
            setBackgroundColor(Color.TRANSPARENT)
            imeOptions = EditorInfo.IME_ACTION_GO
            inputType = android.text.InputType.TYPE_CLASS_TEXT or android.text.InputType.TYPE_TEXT_VARIATION_URI
            setSelectAllOnFocus(true)
            setOnEditorActionListener { _, action, event ->
                if (action == EditorInfo.IME_ACTION_GO || action == EditorInfo.IME_ACTION_DONE ||
                    (event?.keyCode == KeyEvent.KEYCODE_ENTER && event.action == KeyEvent.ACTION_DOWN)) {
                    navigateFromAddress()
                    true
                } else false
            }
        }
        addressRow.addView(address, LinearLayout.LayoutParams(0, dp(48), 1f))
        val go = button("GO", mint, navy) { navigateFromAddress() }
        addressRow.addView(go, LinearLayout.LayoutParams(dp(48), dp(38)))
        root.addView(addressRow, LinearLayout.LayoutParams(-1, dp(52)).apply { topMargin = dp(8) })

        progress = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply {
            max = 100
            progressTintList = android.content.res.ColorStateList.valueOf(mint)
            progressBackgroundTintList = android.content.res.ColorStateList.valueOf(panel)
            visibility = View.GONE
        }
        root.addView(progress, LinearLayout.LayoutParams(-1, dp(2)))

        webHost = FrameLayout(this).apply { setBackgroundColor(navy) }
        home = buildHome()
        root.addView(webHost, LinearLayout.LayoutParams(-1, 0, 1f).apply { topMargin = dp(8) })

        val toolbar = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
            background = rounded(panel, 22)
            setPadding(dp(3), dp(4), dp(3), dp(4))
        }
        listOf(
            Triple("‹", "Back") { goBack() },
            Triple("›", "Forward") { goForward() },
            Triple("↻", "Refresh") { reloadCurrent() },
            Triple("⌂", "Home") { showHome() },
            Triple("☆", "Save bookmark") { toggleBookmark() },
            Triple("☰", "Menu") { showMenu() }
        ).forEach { item ->
            val b = TextView(this).apply {
                text = item.first
                contentDescription = item.second
                textSize = 23f
                setTextColor(white)
                gravity = Gravity.CENTER
                setOnClickListener { item.third() }
            }
            toolbar.addView(b, LinearLayout.LayoutParams(0, dp(46), 1f))
        }
        root.addView(toolbar, LinearLayout.LayoutParams(-1, dp(54)).apply { topMargin = dp(8) })
    }

    private fun buildHome(): LinearLayout {
        val page = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            setPadding(dp(8), dp(48), dp(8), dp(20))
        }
        val orb = TextView(this).apply {
            text = "◉"
            textSize = 46f
            setTextColor(mint)
            gravity = Gravity.CENTER
        }
        page.addView(orb, LinearLayout.LayoutParams(-1, dp(58)))
        page.addView(TextView(this).apply {
            text = "Your web. Your way."
            textSize = 25f
            typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
            setTextColor(white)
            gravity = Gravity.CENTER
        }, LinearLayout.LayoutParams(-1, dp(42)))
        page.addView(TextView(this).apply {
            text = "A calmer place to explore."
            textSize = 14f
            setTextColor(muted)
            gravity = Gravity.CENTER
        }, LinearLayout.LayoutParams(-1, dp(30)))

        val search = EditText(this).apply {
            hint = "Search the web"
            singleLine = true
            textSize = 15f
            setTextColor(white)
            setHintTextColor(muted)
            setPadding(dp(16), 0, dp(16), 0)
            background = rounded(panel, 18)
            imeOptions = EditorInfo.IME_ACTION_GO
            setOnEditorActionListener { _, action, _ ->
                if (action == EditorInfo.IME_ACTION_GO || action == EditorInfo.IME_ACTION_DONE) {
                    address.setText(text.toString())
                    navigateFromAddress()
                    true
                } else false
            }
        }
        page.addView(search, LinearLayout.LayoutParams(-1, dp(54)).apply {
            topMargin = dp(30); leftMargin = dp(4); rightMargin = dp(4)
        })

        page.addView(TextView(this).apply {
            text = "QUICK ACCESS"
            textSize = 11f
            letterSpacing = 0.12f
            setTextColor(muted)
        }, LinearLayout.LayoutParams(-1, dp(28)).apply { topMargin = dp(30) })

        val sites = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        listOf("Wikipedia" to "https://www.wikipedia.org", "YouTube" to "https://m.youtube.com", "GitHub" to "https://github.com", "DuckDuckGo" to "https://duckduckgo.com").forEach { (name, url) ->
            val item = TextView(this).apply {
                text = name
                textSize = 11f
                setTextColor(white)
                gravity = Gravity.CENTER
                background = rounded(panel2, 14)
                setPadding(dp(4), dp(12), dp(4), dp(12))
                setOnClickListener { openUrl(url) }
            }
            sites.addView(item, LinearLayout.LayoutParams(0, dp(56), 1f).apply {
                marginStart = dp(3); marginEnd = dp(3)
            })
        }
        page.addView(sites, LinearLayout.LayoutParams(-1, dp(56)))
        page.addView(TextView(this).apply {
            text = "PRIVATE MODE IS AVAILABLE IN THE MENU"
            textSize = 10f
            letterSpacing = 0.05f
            setTextColor(muted)
            gravity = Gravity.CENTER
        }, LinearLayout.LayoutParams(-1, dp(44)).apply { topMargin = dp(12) })
        return page
    }

    private fun createTab(showHome: Boolean, url: String? = null) {
        val web = WebView(this)
        web.settings.javaScriptEnabled = true
        web.settings.domStorageEnabled = true
        web.settings.loadsImagesAutomatically = true
        web.settings.javaScriptCanOpenWindowsAutomatically = false
        web.settings.setSupportMultipleWindows(false)
        web.settings.allowFileAccess = false
        web.settings.allowContentAccess = false
        web.settings.builtInZoomControls = false
        web.settings.displayZoomControls = false
        web.settings.userAgentString = web.settings.userAgentString
        web.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val scheme = request.url.scheme?.lowercase()
                if (scheme == "http" || scheme == "https") return false
                if (scheme == "mailto" || scheme == "tel") {
                    try { startActivity(android.content.Intent(android.content.Intent.ACTION_VIEW, request.url)) } catch (_: Exception) {}
                    return true
                }
                return true
            }
            override fun onPageStarted(view: WebView, url: String?, favicon: android.graphics.Bitmap?) {
                progress.visibility = View.VISIBLE
                progress.progress = 5
                if (view == currentWeb()) address.setText(url ?: "")
            }
            override fun onPageFinished(view: WebView, url: String?) {
                progress.visibility = View.GONE
                if (view == currentWeb()) {
                    address.setText(url ?: "")
                    val title = view.title ?: url ?: ""
                    if (url != null && url.startsWith("https://")) {
                        if (history.none { it.second == url }) history.add(0, title to url)
                    }
                }
            }
            override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
                if (request.isForMainFrame) {
                    progress.visibility = View.GONE
                    Toast.makeText(this@MainActivity, "Couldn't load this page. Check your connection.", Toast.LENGTH_SHORT).show()
                }
            }
        }
        web.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView, newProgress: Int) {
                if (view == currentWeb()) {
                    progress.progress = newProgress
                    progress.visibility = if (newProgress in 1..99) View.VISIBLE else View.GONE
                }
            }
        }
        web.setDownloadListener(DownloadListener { downloadUrl, userAgent, contentDisposition, mimeType, _ ->
            try {
                val request = DownloadManager.Request(Uri.parse(downloadUrl))
                    .setMimeType(mimeType)
                    .addRequestHeader("User-Agent", userAgent)
                    .setTitle(android.webkit.URLUtil.guessFileName(downloadUrl, contentDisposition, mimeType))
                    .setDescription("Downloading with EONIS Browser")
                    .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                    .setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, android.webkit.URLUtil.guessFileName(downloadUrl, contentDisposition, mimeType))
                (getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager).enqueue(request)
                Toast.makeText(this, "Download started", Toast.LENGTH_SHORT).show()
            } catch (_: Exception) {
                Toast.makeText(this, "Unable to start download", Toast.LENGTH_SHORT).show()
            }
        })
        tabs.add(web)
        active = tabs.lastIndex
        if (showHome) {
            webHost.removeAllViews()
            webHost.addView(home)
            address.setText("")
        } else if (url != null) {
            webHost.removeAllViews()
            webHost.addView(web, FrameLayout.LayoutParams(-1, -1))
            web.loadUrl(url)
        }
        updateTabLabel()
    }

    private fun currentWeb(): WebView? = tabs.getOrNull(active)

    private fun openUrl(url: String) {
        val web = currentWeb() ?: run { createTab(false, url); return }
        webHost.removeAllViews()
        webHost.addView(web, FrameLayout.LayoutParams(-1, -1))
        web.loadUrl(url)
    }

    private fun navigateFromAddress() {
        val raw = address.text.toString().trim()
        if (raw.isBlank()) return
        val target = when {
            raw.startsWith("https://", true) || raw.startsWith("http://", true) -> raw
            raw.contains(" ") || !raw.contains(".") -> "https://duckduckgo.com/?q=" + URLEncoder.encode(raw, "UTF-8")
            else -> "https://$raw"
        }
        try {
            val uri = Uri.parse(target)
            if (uri.scheme != "https" && uri.scheme != "http") {
                Toast.makeText(this, "Only web addresses are supported", Toast.LENGTH_SHORT).show()
                return
            }
        } catch (_: Exception) {
            Toast.makeText(this, "That address doesn't look valid", Toast.LENGTH_SHORT).show()
            return
        }
        openUrl(target)
        (getSystemService(INPUT_METHOD_SERVICE) as InputMethodManager).hideSoftInputFromWindow(address.windowToken, 0)
        address.clearFocus()
    }

    private fun showHome() {
        webHost.removeAllViews()
        webHost.addView(home)
        address.setText("")
    }

    private fun goBack() {
        val web = currentWeb()
        if (web?.canGoBack() == true) web.goBack() else showHome()
    }

    private fun goForward() {
        val web = currentWeb()
        if (web?.canGoForward() == true) web.goForward()
    }

    private fun reloadCurrent() {
        val web = currentWeb()
        if (web?.url.isNullOrBlank() || web?.url == "about:blank") showHome() else web?.reload()
    }

    private fun updateTabLabel() {
        if (::tabLabel.isInitialized) tabLabel.text = "${tabs.size} TAB" + if (tabs.size == 1) "" else "S"
    }

    private fun showTabs() {
        val labels = tabs.mapIndexed { i, web -> "${i + 1}. ${web.title?.takeIf { it.isNotBlank() } ?: web.url ?: "New tab"}" }.toMutableList()
        labels.add("＋  New tab")
        AlertDialog.Builder(this).setTitle("Your tabs").setItems(labels.toTypedArray()) { _, which ->
            if (which == tabs.size) createTab(true) else switchTab(which)
        }.setNeutralButton("Close current tab") { _, _ -> closeCurrentTab() }.setNegativeButton("Done", null).show()
    }

    private fun switchTab(index: Int) {
        if (index !in tabs.indices) return
        active = index
        val web = tabs[active]
        webHost.removeAllViews()
        if (web.url.isNullOrBlank()) webHost.addView(home)
        else webHost.addView(web, FrameLayout.LayoutParams(-1, -1))
        address.setText(web.url ?: "")
        updateTabLabel()
    }

    private fun closeCurrentTab() {
        if (tabs.size <= 1) {
            currentWeb()?.stopLoading()
            currentWeb()?.loadUrl("about:blank")
            showHome()
            return
        }
        tabs.removeAt(active).destroy()
        active = (active - 1).coerceAtLeast(0)
        switchTab(active)
    }

    private fun toggleBookmark() {
        val web = currentWeb()
        val url = web?.url
        if (url.isNullOrBlank() || !url.startsWith("http")) {
            Toast.makeText(this, "Open a website first", Toast.LENGTH_SHORT).show()
            return
        }
        val existing = bookmarks.indexOfFirst { it.second == url }
        if (existing >= 0) {
            bookmarks.removeAt(existing)
            Toast.makeText(this, "Bookmark removed", Toast.LENGTH_SHORT).show()
        } else {
            bookmarks.add(0, (web.title ?: url) to url)
            Toast.makeText(this, "Bookmark saved", Toast.LENGTH_SHORT).show()
        }
    }

    private fun showMenu() {
        val options = arrayOf("Bookmarks", "History", "New tab", "Private tab", "Downloads", "Close current tab")
        AlertDialog.Builder(this).setTitle("EONIS Browser").setItems(options) { _, which ->
            when (which) {
                0 -> showSaved("Bookmarks", bookmarks)
                1 -> showSaved("History", history)
                2 -> createTab(true)
                3 -> openPrivateTab()
                4 -> try {
                    startActivity(android.content.Intent(DownloadManager.ACTION_VIEW_DOWNLOADS))
                } catch (_: Exception) { Toast.makeText(this, "Open Downloads from your device", Toast.LENGTH_SHORT).show() }
                5 -> closeCurrentTab()
            }
        }.show()
    }

    private fun showSaved(title: String, items: List<Pair<String, String>>) {
        if (items.isEmpty()) {
            Toast.makeText(this, "Nothing here yet", Toast.LENGTH_SHORT).show()
            return
        }
        AlertDialog.Builder(this).setTitle(title)
            .setItems(items.map { it.first }.toTypedArray()) { _, index -> openUrl(items[index].second) }
            .setNegativeButton("Done", null).show()
    }

    private fun openPrivateTab() {
        privateMode = true
        val web = WebView(this)
        web.settings.javaScriptEnabled = true
        web.settings.domStorageEnabled = false
        web.settings.cacheMode = android.webkit.WebSettings.LOAD_NO_CACHE
        web.settings.allowFileAccess = false
        web.settings.allowContentAccess = false
        web.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                return request.url.scheme != "https" && request.url.scheme != "http"
            }
            override fun onPageStarted(view: WebView, url: String?, favicon: android.graphics.Bitmap?) {
                if (view == currentWeb()) address.setText(url ?: "")
            }
            override fun onPageFinished(view: WebView, url: String?) {
                if (view == currentWeb()) address.setText(url ?: "")
            }
        }
        web.webChromeClient = WebChromeClient()
        tabs.add(web)
        active = tabs.lastIndex
        webHost.removeAllViews()
        webHost.addView(web, FrameLayout.LayoutParams(-1, -1))
        address.setText("https://duckduckgo.com")
        web.loadUrl("https://duckduckgo.com")
        updateTabLabel()
        Toast.makeText(this, "Private-style tab: history isn't saved, but cookies may be shared.", Toast.LENGTH_LONG).show()
    }

    private fun button(label: String, bg: Int, fg: Int, action: () -> Unit): Button =
        Button(this).apply {
            text = label
            textSize = 11f
            isAllCaps = false
            setTextColor(fg)
            background = rounded(bg, 14)
            setPadding(dp(4), 0, dp(4), 0)
            setOnClickListener { action() }
        }

    private fun rounded(color: Int, radius: Int): GradientDrawable =
        GradientDrawable().apply {
            setColor(color)
            cornerRadius = dp(radius).toFloat()
        }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

    override fun onBackPressed() {
        val web = currentWeb()
        if (web?.canGoBack() == true) web.goBack() else if (webHost.getChildAt(0) !== home) showHome() else super.onBackPressed()
    }

    override fun onDestroy() {
        tabs.forEach { it.stopLoading(); it.destroy() }
        tabs.clear()
        super.onDestroy()
    }
}
