import ExpoModulesCore
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

class AirplayRoutePickerView: ExpoView {
  let picker = AVRoutePickerView()

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    picker.prioritizesVideoDevices = true
    addSubview(picker)
    picker.translatesAutoresizingMaskIntoConstraints = false
    NSLayoutConstraint.activate([
      picker.leadingAnchor.constraint(equalTo: leadingAnchor),
      picker.trailingAnchor.constraint(equalTo: trailingAnchor),
      picker.topAnchor.constraint(equalTo: topAnchor),
      picker.bottomAnchor.constraint(equalTo: bottomAnchor),
    ])
  }
}
