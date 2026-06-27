use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      // Haptic feedback — только на Android и iOS
      #[cfg(feature = "mobile")]
      app.handle().plugin(tauri_plugin_haptics::init())?;

      // ── Spawn the Taskbar Battle Strip (Windows desktop only) ──
      #[cfg(target_os = "windows")]
      {
        if let Err(e) = spawn_battle_strip(app) {
          log::warn!("Failed to spawn battle strip: {:?}", e);
        }
      }

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

/// Creates a 72-px tall always-on-top transparent strip window anchored just above the Windows taskbar.
#[cfg(target_os = "windows")]
fn spawn_battle_strip(app: &mut tauri::App) -> tauri::Result<()> {
  use tauri::WebviewWindowBuilder;

  // Determine screen dimensions via the main window
  let main_win = app.get_webview_window("main");

  let (screen_w_logical, screen_h_logical, scale_factor) = main_win
    .as_ref()
    .and_then(|w| w.current_monitor().ok().flatten())
    .map(|monitor| {
      let sf = monitor.scale_factor();
      let size = monitor.size(); // PhysicalSize
      // Convert to logical pixels (what Tauri builder expects)
      (
        size.width as f64 / sf,
        size.height as f64 / sf,
        sf,
      )
    })
    .unwrap_or((1920.0, 1080.0, 1.0));

  // Windows taskbar is typically 40 logical pixels tall on 1x displays
  let taskbar_h_logical: f64 = 40.0;
  let strip_h_logical: f64 = 72.0;
  let strip_y = screen_h_logical - taskbar_h_logical - strip_h_logical;
  let _ = scale_factor; // used implicitly above

  let _strip_window = WebviewWindowBuilder::new(
    app,
    "battle-strip",
    tauri::WebviewUrl::App("battle-strip.html".into()),
  )
  .title("MIND OS Battle Strip")
  .inner_size(screen_w_logical, strip_h_logical)
  .position(0.0, strip_y.max(0.0))
  .resizable(false)
  .maximizable(false)
  .minimizable(false)
  .closable(false)
  .decorations(false)
  .transparent(true)
  .always_on_top(true)
  .skip_taskbar(true)
  .focused(false)
  .build()?;

  Ok(())
}
