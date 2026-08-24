import GObject from "gi://GObject";
import St from "gi://St";
import Clutter from "gi://Clutter";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import * as PanelMenu from "resource:///org/gnome/shell/ui/panelMenu.js";

const TrayToggleButton = GObject.registerClass(
    class TrayToggleButton extends PanelMenu.Button {
        _init() {
            super._init(0.0, "Tray Toggle", true);

            // State tracking
            this._trayVisible = true;
            this._hiddenActors = [];

            // Create icon — invisible until hovered
            this._icon = new St.Icon({
                icon_name: "orientation-portrait-left-symbolic",
                style_class: "system-status-icon",
                opacity: 0,
            });

            this.add_child(this._icon);

            // Fade icon in/out on hover
            this.connect("notify::hover", () => {
                this._icon.ease({
                    opacity: this.hover ? 255 : 0,
                    duration: 150,
                    mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                });
            });
        }

        vfunc_event(event) {
            if (
                event.type() === Clutter.EventType.BUTTON_PRESS ||
                event.type() === Clutter.EventType.TOUCH_BEGIN
            ) {
                this._toggleTray();
                return Clutter.EVENT_STOP;
            }

            return Clutter.EVENT_PROPAGATE;
        }

        _toggleTray() {
            this._trayVisible = !this._trayVisible;
            this._updateTrayVisibility();
        }

        _updateTrayVisibility() {
            // Animate icon change with a subtle rotation
            this._icon.ease({
                rotation_angle_z: 0,
                duration: 0,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                onComplete: () => {
                    this._icon.rotation_angle_z = 0;
                },
            });

            // Update icon and tray visibility
            if (this._trayVisible) {
                this._icon.icon_name = "orientation-portrait-right-symbolic";
                this._showTray();
            } else {
                this._icon.icon_name = "orientation-portrait-left-symbolic";
                this._hideTray();
            }
        }

        _hideTray() {
            this._hiddenActors = [];
            const rightBox = Main.panel._rightBox;

            if (!rightBox) return;

            // System items to keep visible (never hide these)
            const systemItems = [
                "quickSettings", // System menu (network, sound, power, etc.)
                "keyboard", // Keyboard layout
                "dwellClick", // Accessibility
                "screenSharing", // Screen sharing indicator
                "screenRecording", // Screen recording indicator
                "tray-toggle", // Our own button
            ];

            // Get all children in the right box
            const children = rightBox.get_children();

            for (let child of children) {
                // Skip our own button
                if (child === this.container) continue;

                // Check if this child belongs to a system item
                let isSystemItem = false;
                for (let key in Main.panel.statusArea) {
                    if (
                        systemItems.includes(key) &&
                        Main.panel.statusArea[key].container === child
                    ) {
                        isSystemItem = true;
                        break;
                    }
                }

                // Hide only non-system items (AppIndicators) with slide animation
                if (!isSystemItem && child.visible) {
                    this._hiddenActors.push(child);

                    // Slide to the right and fade out
                    child.ease({
                        opacity: 0,
                        translation_x: 50, // Slide 50px to the right
                        duration: 250,
                        mode: Clutter.AnimationMode.EASE_IN_OUT_QUAD,
                        onComplete: () => {
                            child.hide();
                            child.translation_x = 0; // Reset for next show
                        },
                    });
                }
            }
        }

        _showTray() {
            // Restore visibility of previously hidden actors with slide animation
            for (let actor of this._hiddenActors) {
                actor.opacity = 0;
                actor.translation_x = 50; // Start 50px to the right
                actor.show();

                // Slide from right and fade in
                actor.ease({
                    opacity: 255,
                    translation_x: 0,
                    duration: 250,
                    mode: Clutter.AnimationMode.EASE_IN_OUT_QUAD,
                });
            }
            this._hiddenActors = [];
        }

        destroy() {
            // Restore tray visibility on destroy
            if (!this._trayVisible) {
                this._showTray();
            }
            super.destroy();
        }
    },
);

export default class TrayToggleExtension {
    constructor() {
        this._button = null;
    }

    enable() {
        // Create the toggle button
        this._button = new TrayToggleButton();

        // Add to panel at position 1 (just left of most app indicators)
        Main.panel.addToStatusArea("tray-toggle", this._button, 1, "right");
    }

    disable() {
        // Clean up
        if (this._button) {
            this._button.destroy();
            this._button = null;
        }
    }
}
