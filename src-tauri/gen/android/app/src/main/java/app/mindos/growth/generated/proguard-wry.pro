# THIS FILE IS AUTO-GENERATED. DO NOT MODIFY!!

# Copyright 2020-2023 Tauri Programme within The Commons Conservancy
# SPDX-License-Identifier: Apache-2.0
# SPDX-License-Identifier: MIT

-keep class app.mindos.growth.* {
  native <methods>;
}

-keep class app.mindos.growth.WryActivity {
  public <init>(...);

  void setWebView(app.mindos.growth.RustWebView);
  java.lang.Class getAppClass(...);
  int getId();
  java.lang.String getVersion();
  int startActivity(...);
}

-keep class app.mindos.growth.Ipc {
  public <init>(...);

  @android.webkit.JavascriptInterface public <methods>;
}

-keep class app.mindos.growth.RustWebView {
  public <init>(...);

  void loadUrlMainThread(...);
  void loadHTMLMainThread(...);
  void evalScript(...);
}

-keep class app.mindos.growth.RustWebChromeClient,app.mindos.growth.RustWebViewClient {
  public <init>(...);
}
