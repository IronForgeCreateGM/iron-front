// Iron Front v7.7.7: Game Center Quick Match bridge for the iPhone app (Capacitor 8 local plugin).
// JS side: js/quickmatch.js (window.Capacitor.Plugins.IronGameCenter). Setup steps: GAME-CENTER.md.
// Only matchmaking + a reliable message pipe live here; every message is still validated in JS (v7.7.6 filters).
import Foundation
import Capacitor
import GameKit

@objc(IronGameCenterPlugin)
public class IronGameCenterPlugin: CAPPlugin, CAPBridgedPlugin, GKMatchDelegate {
    public let identifier = "IronGameCenterPlugin"
    public let jsName = "IronGameCenter"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "authenticate", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "findMatch", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "addPlayers", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stopSearch", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "send", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "disconnect", returnType: CAPPluginReturnPromise),
    ]
    private var match: GKMatch?
    private let maxBytes = 64 * 1024 // GKMatch reliable messages should stay small; the JS caps are far below this

    private func info(_ p: GKPlayer) -> [String: Any] { ["playerId": p.gamePlayerID, "alias": p.displayName] }
    private func request(_ call: CAPPluginCall) -> GKMatchRequest {
        let r = GKMatchRequest()
        r.minPlayers = max(2, min(8, call.getInt("minPlayers") ?? 2))
        r.maxPlayers = max(2, min(8, call.getInt("maxPlayers") ?? 8))
        r.playerGroup = call.getInt("playerGroup") ?? 0 // same build only (JS: qmGroup)
        return r
    }

    @objc func authenticate(_ call: CAPPluginCall) {
        let lp = GKLocalPlayer.local
        if lp.isAuthenticated { call.resolve(info(lp)); return }
        var done = false
        lp.authenticateHandler = { [weak self] vc, error in
            DispatchQueue.main.async {
                if let vc = vc { self?.bridge?.viewController?.present(vc, animated: true); return } // Apple's sign-in sheet
                if done { return }; done = true
                if lp.isAuthenticated, let me = self?.info(lp) { call.resolve(me) }
                else { call.reject(error?.localizedDescription ?? "Game Center is not signed in") }
            }
        }
    }

    @objc func findMatch(_ call: CAPPluginCall) {
        guard GKLocalPlayer.local.isAuthenticated else { call.reject("not signed in"); return }
        GKMatchmaker.shared().findMatch(for: request(call)) { [weak self] m, error in
            DispatchQueue.main.async {
                guard let self = self, let m = m else { call.reject(error?.localizedDescription ?? "no match"); return }
                self.match?.disconnect(); self.match = m; m.delegate = self
                call.resolve(["players": m.players.map { self.info($0) }])
            }
        }
    }

    @objc func addPlayers(_ call: CAPPluginCall) { // keep filling the match while the countdown runs
        guard let m = match else { call.reject("no match"); return }
        GKMatchmaker.shared().addPlayers(to: m, matchRequest: request(call)) { error in
            if let e = error { call.reject(e.localizedDescription) } else { call.resolve() } // new players arrive via didChange .connected
        }
    }

    @objc func stopSearch(_ call: CAPPluginCall) {
        if let m = match { GKMatchmaker.shared().finishMatchmaking(for: m) } else { GKMatchmaker.shared().cancel() }
        call.resolve()
    }

    @objc func send(_ call: CAPPluginCall) {
        guard let m = match, let s = call.getString("data"), let data = s.data(using: .utf8), data.count <= maxBytes else { call.reject("bad send"); return }
        do {
            if let to = call.getArray("to", String.self), !to.isEmpty {
                let ps = m.players.filter { to.contains($0.gamePlayerID) }
                if !ps.isEmpty { try m.send(data, to: ps, dataMode: .reliable) }
            } else { try m.sendData(toAllPlayers: data, with: .reliable) }
            call.resolve()
        } catch { call.reject(error.localizedDescription) }
    }

    @objc func disconnect(_ call: CAPPluginCall) {
        match?.delegate = nil; match?.disconnect(); match = nil; GKMatchmaker.shared().cancel(); call.resolve()
    }

    // ---- GKMatchDelegate -> JS events ----
    public func match(_ match: GKMatch, didReceive data: Data, fromRemotePlayer player: GKPlayer) {
        guard match === self.match, data.count <= maxBytes, let s = String(data: data, encoding: .utf8) else { return }
        notifyListeners("data", data: ["from": player.gamePlayerID, "data": s])
    }
    public func match(_ match: GKMatch, player: GKPlayer, didChange state: GKPlayerConnectionState) {
        guard match === self.match else { return }
        switch state {
        case .connected: notifyListeners("playerConnected", data: info(player))
        case .disconnected: notifyListeners("playerDisconnected", data: ["playerId": player.gamePlayerID])
        default: break
        }
    }
    public func match(_ match: GKMatch, didFailWithError error: Error?) {
        guard match === self.match else { return }
        for p in match.players { notifyListeners("playerDisconnected", data: ["playerId": p.gamePlayerID]) }
    }
}
