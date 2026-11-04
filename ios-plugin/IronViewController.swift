// Registers the local IronGameCenter plugin with Capacitor 8 (local plugins are not auto-discovered).
// In Main.storyboard set the Bridge View Controller's custom class to IronViewController (module: App).
import UIKit
import Capacitor

class IronViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(IronGameCenterPlugin())
    }
}
