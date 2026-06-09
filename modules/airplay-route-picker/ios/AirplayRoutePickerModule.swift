import ExpoModulesCore
import AVFAudio
import AVKit

public class AirplayRoutePickerModule: Module {
  public func definition() -> ModuleDefinition {
    Name("AirplayRoutePicker")

    View(AirplayRoutePickerView.self) {
      Prop("tint") { (view: AirplayRoutePickerView, color: UIColor?) in
        view.picker.tintColor = color
      }
      Prop("activeTint") { (view: AirplayRoutePickerView, color: UIColor?) in
        view.picker.activeTintColor = color
      }
    }
  }
}

class AirplayRoutePickerView: ExpoView, AVRoutePickerViewDelegate {
  let picker = AVRoutePickerView()

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    picker.prioritizesVideoDevices = true
    picker.delegate = self
    addSubview(picker)
    picker.translatesAutoresizingMaskIntoConstraints = false
    NSLayoutConstraint.activate([
      picker.leadingAnchor.constraint(equalTo: leadingAnchor),
      picker.trailingAnchor.constraint(equalTo: trailingAnchor),
      picker.topAnchor.constraint(equalTo: topAnchor),
      picker.bottomAnchor.constraint(equalTo: bottomAnchor),
    ])
  }

  override func didMoveToWindow() {
    super.didMoveToWindow()
    if window != nil {
      configureLongFormVideoRouting()
    }
  }

  func routePickerViewWillBeginPresentingRoutes(_ routePickerView: AVRoutePickerView) {
    // react-native-video configures the shared audio session itself. Re-apply the
    // video policy immediately before route selection so AirPlay moves the
    // AVPlayer video as well as its audio.
    configureLongFormVideoRouting()
  }

  private func configureLongFormVideoRouting() {
    do {
      try AVAudioSession.sharedInstance().setCategory(
        .playback,
        mode: .moviePlayback,
        policy: .longFormVideo
      )
    } catch {
      print(
        "[AirplayRoutePicker] Failed to configure long-form video routing: \(error.localizedDescription)"
      )
    }
  }
}
