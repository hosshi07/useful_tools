import sys
import os
import ctypes
import random
from PyQt6.QtWidgets import (QApplication, QWidget, QVBoxLayout, QHBoxLayout, 
                             QPushButton, QLabel, QFileDialog, QStyle, QSlider,
                             QListWidget, QListWidgetItem)
from PyQt6.QtCore import Qt, QUrl
from PyQt6.QtGui import QPixmap, QImage, QIcon, QColor
from PyQt6.QtMultimedia import QMediaPlayer, QAudioOutput

from config import load_config, save_config
from metadata_parser import get_metadata

class VolumePopup(QWidget):
    def __init__(self, parent=None, audio_output=None):
        super().__init__(parent, Qt.WindowType.Popup)
        self.audio_output = audio_output
        self.layout = QVBoxLayout(self)
        self.layout.setContentsMargins(10, 15, 10, 15)
        self.slider = QSlider(Qt.Orientation.Vertical)
        self.slider.setRange(0, 100)
        
        current_volume = self.audio_output.volume()
        self.slider.setValue(int(current_volume * 100))
        self.slider.valueChanged.connect(self.set_volume)
        
        self.layout.addWidget(self.slider, alignment=Qt.AlignmentFlag.AlignHCenter)
        self.setFixedSize(40, 150)
        
        self.setStyleSheet("""
            QWidget {
                background-color: #2D2736;
                border: 1px solid #3B3347;
                border-radius: 8px;
            }
            QSlider::groove:vertical {
                border: 1px solid #3B3347;
                width: 6px;
                background: #1E1A24;
                border-radius: 3px;
            }
            QSlider::sub-page:vertical {
                background: #1E1A24;
                border-radius: 3px;
            }
            QSlider::add-page:vertical {
                background: #867BA9;
                border-radius: 3px;
            }
            QSlider::handle:vertical {
                background: #FFFFFF;
                border: 2px solid #867BA9;
                height: 14px;
                margin-left: -5px;
                margin-right: -5px;
                border-radius: 8px;
            }
            QSlider::handle:vertical:hover {
                background: #A395C9;
                border: 2px solid #FFFFFF;
            }
        """)
        
    def set_volume(self, value):
        self.audio_output.setVolume(value / 100.0)

class MusicPlayer(QWidget):
    def __init__(self):
        super().__init__()
        self.config = load_config()
        self.original_playlist = []
        self.playlist = []
        self.current_index = 0
        self.is_mini_mode = False
        self.play_modes = ["folder", "50-on", "loop", "random"]
        self.current_play_mode_index = 0
        self.original_flags = self.windowFlags()
        
        self.init_player()
        self.init_ui()
        self.load_last_folder()

    def init_player(self):
        self.player = QMediaPlayer()
        self.audio_output = QAudioOutput()
        self.player.setAudioOutput(self.audio_output)
        self.player.mediaStatusChanged.connect(self.on_media_status_changed)
        self.player.playbackStateChanged.connect(self.on_playback_state_changed)
        self.player.positionChanged.connect(self.on_position_changed)
        self.player.durationChanged.connect(self.on_duration_changed)

    def init_ui(self):
        self.setWindowTitle("Music Player Hosshi v3.1")
        
        # Determine the base path for assets, works for dev and for PyInstaller
        if getattr(sys, 'frozen', False) and hasattr(sys, '_MEIPASS'):
            base_path = sys._MEIPASS
        else:
            base_path = os.path.abspath(".")
            
        icon_path = os.path.join(base_path, "image", "music_hosshi_logo_noback.png")
        if os.path.exists(icon_path):
            self.setWindowIcon(QIcon(icon_path))
            
        if sys.platform == "win32":
            try:
                hwnd = self.winId()
                DWMWA_USE_IMMERSIVE_DARK_MODE = 20
                set_window_attribute = ctypes.windll.dwmapi.DwmSetWindowAttribute
                set_window_attribute(int(hwnd), DWMWA_USE_IMMERSIVE_DARK_MODE, ctypes.byref(ctypes.c_int(2)), ctypes.sizeof(ctypes.c_int(2)))
            except Exception:
                pass
                
        self.resize(400, 500)
        
        self.main_layout = QHBoxLayout()
        self.left_layout = QVBoxLayout()
        
        # Cover Art Label
        self.cover_label = QLabel()
        self.cover_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.cover_label.setMinimumSize(100, 100)
        self.set_default_cover()
        
        # Title Label
        self.title_label = QLabel("No Song Playing")
        self.title_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.title_label.setWordWrap(True)
        
        # Playback Options (Volume & Play Mode)
        self.playback_options_layout = QHBoxLayout()
        self.playback_options_layout.addStretch()
        
        self.btn_volume = QPushButton("🔊")
        self.btn_volume.setFixedSize(40, 30)
        self.btn_volume.setStyleSheet("padding: 0px; font-size: 16px;")
        self.btn_volume.clicked.connect(self.show_volume_popup)
        self.btn_volume.setToolTip("Volume")
        
        self.btn_playmode = QPushButton("≡")
        self.btn_playmode.setFixedSize(40, 30)
        self.btn_playmode.setStyleSheet("padding: 0px; font-size: 16px;")
        self.btn_playmode.clicked.connect(self.cycle_play_mode)
        self.btn_playmode.setToolTip("Playback Mode")
        
        self.playback_options_layout.addWidget(self.btn_volume)
        self.playback_options_layout.addWidget(self.btn_playmode)
        
        # Progress Slider
        self.progress_slider = QSlider(Qt.Orientation.Horizontal)
        self.progress_slider.setRange(0, 0)
        self.progress_slider.sliderMoved.connect(self.set_position)
        
        # Controls
        self.controls_layout = QHBoxLayout()
        
        self.btn_prev = QPushButton("Prev (<-)")
        self.btn_prev.clicked.connect(self.prev_song)
        
        self.btn_play = QPushButton("Play/Pause")
        self.btn_play.clicked.connect(self.toggle_play)
        
        self.btn_next = QPushButton("Next (->)")
        self.btn_next.clicked.connect(self.next_song)
        
        self.controls_layout.addWidget(self.btn_prev)
        self.controls_layout.addWidget(self.btn_play)
        self.controls_layout.addWidget(self.btn_next)
        
        # Top Buttons Layout
        self.top_layout = QHBoxLayout()
        self.btn_folder = QPushButton("Select Folder")
        self.btn_folder.clicked.connect(self.select_folder)
        
        self.btn_playlist = QPushButton("Playlist")
        self.btn_playlist.clicked.connect(self.toggle_playlist)
        
        self.btn_mini = QPushButton("Mini Player")
        self.btn_mini.clicked.connect(self.toggle_mini_mode)
        
        self.top_layout.addWidget(self.btn_folder)
        self.top_layout.addWidget(self.btn_playlist)
        self.top_layout.addWidget(self.btn_mini)
        
        self.left_layout.addLayout(self.top_layout)
        self.left_layout.addWidget(self.cover_label)
        self.left_layout.addWidget(self.title_label)
        self.left_layout.addLayout(self.playback_options_layout)
        self.left_layout.addWidget(self.progress_slider)
        self.left_layout.addLayout(self.controls_layout)
        
        self.main_layout.addLayout(self.left_layout)
        
        self.playlist_widget = QListWidget()
        self.playlist_widget.hide()
        self.playlist_widget.itemDoubleClicked.connect(self.play_selected_song)
        self.main_layout.addWidget(self.playlist_widget)
        
        self.setLayout(self.main_layout)
        
        self.setup_stylesheet()
        
        # Enable key events on main widget
        self.setFocusPolicy(Qt.FocusPolicy.StrongFocus)

    def setup_stylesheet(self):
        style = """
        QWidget {
            background-color: #1E1A24;
            color: #E6E4F0;
            font-family: 'Segoe UI', 'Meiryo', sans-serif;
        }
        
        QLabel#TitleLabel {
            font-size: 18px;
            font-weight: bold;
            color: #FFFFFF;
            padding: 10px;
        }
        
        QPushButton {
            background-color: #3B3347;
            border: none;
            border-radius: 8px;
            padding: 8px 16px;
            color: #E6E4F0;
            font-size: 14px;
            font-weight: bold;
        }
        
        QPushButton:hover {
            background-color: #867BA9;
            border-color: #A395C9;
            color: #FFFFFF;
        }
        
        QPushButton:pressed {
            background-color: #6C6287;
        }
        
        QPushButton#PlayButton {
            background-color: #867BA9;
            border-color: #A395C9;
        }
        
        QPushButton#PlayButton:hover {
            background-color: #A395C9;
        }
        
        QSlider::groove:horizontal {
            border: 1px solid #3B3347;
            height: 6px;
            background: #2D2736;
            border-radius: 3px;
        }
        
        QSlider::sub-page:horizontal {
            background: #867BA9;
            border-radius: 3px;
        }
        
        QSlider::handle:horizontal {
            background: #FFFFFF;
            border: 2px solid #867BA9;
            width: 14px;
            margin-top: -5px;
            margin-bottom: -5px;
            border-radius: 8px;
        }
        
        QSlider::handle:horizontal:hover {
            background: #A395C9;
            border: 2px solid #FFFFFF;
        }
        
        QListWidget {
            background-color: #2D2736;
            color: #E6E4F0;
            border: 1px solid #3B3347;
            border-radius: 8px;
            padding: 5px;
            font-size: 14px;
        }
        QListWidget::item {
            padding: 8px;
            border-radius: 4px;
        }
        QListWidget::item:hover {
            background-color: #3B3347;
        }
        QListWidget::item:selected {
            background-color: #6C6287;
            color: #FFFFFF;
        }
        """
        self.setStyleSheet(style)
        self.title_label.setObjectName("TitleLabel")
        self.btn_play.setObjectName("PlayButton")

    def set_default_cover(self, size=300):
        # Use a standard note/media icon for fallback
        icon = self.style().standardIcon(QStyle.StandardPixmap.SP_MediaPlay)
        pixmap = icon.pixmap(size, size)
        self.cover_label.setPixmap(pixmap)

    def load_last_folder(self):
        folder = self.config.get("last_folder", "")
        if folder and os.path.isdir(folder):
            self.load_folder(folder, auto_play=False)

    def select_folder(self):
        folder = QFileDialog.getExistingDirectory(self, "Select Music Folder")
        if folder:
            self.config["last_folder"] = folder
            save_config(self.config)
            self.load_folder(folder, auto_play=True)

    def load_folder(self, folder, auto_play=False):
        self.original_playlist = []
        supported_ext = ('.mp3', '.m4a', '.flac')
        for f in os.listdir(folder):
            if f.lower().endswith(supported_ext):
                self.original_playlist.append(os.path.join(folder, f))
        
        if self.original_playlist:
            self.apply_play_mode()
            if auto_play:
                self.play_song(0)
            else:
                self.update_ui_for_song(self.playlist[0])

    def update_ui_for_song(self, filepath):
        meta = get_metadata(filepath)
        title = meta.get("title", os.path.basename(filepath))
        
        if self.is_mini_mode:
            # truncate title for mini mode
            if len(title) > 15:
                title = title[:15] + "..."
                
        self.title_label.setText(title)
        
        size = 130 if self.is_mini_mode else 300
        
        if meta.get("cover_data"):
            image = QImage.fromData(meta["cover_data"])
            pixmap = QPixmap.fromImage(image)
            pixmap = pixmap.scaled(size, size, Qt.AspectRatioMode.KeepAspectRatio, Qt.TransformationMode.SmoothTransformation)
            self.cover_label.setPixmap(pixmap)
        else:
            self.set_default_cover(size)
            
        self.update_playlist_ui()

    def play_song(self, index):
        if not self.playlist: return
        self.current_index = index % len(self.playlist)
        filepath = self.playlist[self.current_index]
        
        self.player.setSource(QUrl.fromLocalFile(filepath))
        self.player.play()
        self.update_ui_for_song(filepath)

    def toggle_play(self):
        if self.player.playbackState() == QMediaPlayer.PlaybackState.PlayingState:
            self.player.pause()
        else:
            self.player.play()

    def next_song(self):
        self.play_song(self.current_index + 1)

    def prev_song(self):
        self.play_song(self.current_index - 1)

    def on_media_status_changed(self, status):
        if status == QMediaPlayer.MediaStatus.EndOfMedia:
            if self.play_modes[self.current_play_mode_index] == "loop":
                self.play_song(self.current_index)
            else:
                self.next_song()

    def on_playback_state_changed(self, state):
        if state == QMediaPlayer.PlaybackState.PlayingState:
            self.btn_play.setText("Pause")
            self.btn_play.setStyleSheet("background-color: #704CBC; color: #FFFFFF;")
        else:
            self.btn_play.setText("Play")
            self.btn_play.setStyleSheet("background-color: #eb6ea5; color: #FFFFFF;")

    def on_position_changed(self, position):
        if not self.progress_slider.isSliderDown():
            self.progress_slider.setValue(position)

    def on_duration_changed(self, duration):
        self.progress_slider.setRange(0, duration)

    def set_position(self, position):
        self.player.setPosition(position)
    def cycle_play_mode(self):
        self.current_play_mode_index = (self.current_play_mode_index + 1) % len(self.play_modes)
        mode = self.play_modes[self.current_play_mode_index]
        
        icons = {"folder": "≡", "50-on": "50", "loop": "∞", "random": "⇋"}
        self.btn_playmode.setText(icons[mode])
        
        self.apply_play_mode()

    def apply_play_mode(self):
        if not self.original_playlist:
            return
            
        mode = self.play_modes[self.current_play_mode_index]
        current_song = self.playlist[self.current_index] if self.playlist else None
        
        if mode == "folder":
            self.playlist = list(self.original_playlist)
        elif mode == "50-on":
            self.playlist = sorted(self.original_playlist, key=lambda x: get_metadata(x).get("title", os.path.basename(x)))
        elif mode == "random":
            self.playlist = list(self.original_playlist)
            random.shuffle(self.playlist)
        # "loop" mode does not shuffle or sort; it stays in current playlist order
        
        if current_song and current_song in self.playlist:
            self.current_index = self.playlist.index(current_song)
        else:
            self.current_index = 0
            
        self.update_playlist_ui()

    def show_volume_popup(self):
        if not hasattr(self, 'volume_popup'):
            self.volume_popup = VolumePopup(self, self.audio_output)
            
        pos = self.btn_volume.mapToGlobal(self.btn_volume.rect().topLeft())
        self.volume_popup.move(pos.x(), pos.y() - self.volume_popup.height())
        self.volume_popup.show()
    def toggle_playlist(self):
        if self.playlist_widget.isHidden():
            self.playlist_widget.show()
            self.resize(700, 500)
            self.btn_playlist.setStyleSheet("background-color: #867BA9; color: #FFFFFF;")
        else:
            self.playlist_widget.hide()
            self.resize(400, 500)
            self.btn_playlist.setStyleSheet("")

    def play_selected_song(self, item):
        index = item.data(Qt.ItemDataRole.UserRole)
        self.play_song(index)

    def update_playlist_ui(self):
        if not hasattr(self, 'playlist_widget'): return
        self.playlist_widget.clear()
        for i, filepath in enumerate(self.playlist):
            meta = get_metadata(filepath)
            title = meta.get("title", os.path.basename(filepath))
            item = QListWidgetItem(title)
            item.setData(Qt.ItemDataRole.UserRole, i)
            
            if i == self.current_index:
                item.setBackground(QColor("#867BA9"))
                item.setForeground(QColor("#FFFFFF"))
                font = item.font()
                font.setBold(True)
                item.setFont(font)
                
            self.playlist_widget.addItem(item)
            
        if self.current_index < self.playlist_widget.count():
            item = self.playlist_widget.item(self.current_index)
            self.playlist_widget.scrollToItem(item)

    def keyPressEvent(self, event):
        if event.key() == Qt.Key.Key_Right:
            self.next_song()
        elif event.key() == Qt.Key.Key_Left:
            self.prev_song()
        elif event.key() == Qt.Key.Key_Space:
            self.toggle_play()
        else:
            super().keyPressEvent(event)

    def mousePressEvent(self, event):
        if self.is_mini_mode:
            if event.button() == Qt.MouseButton.LeftButton:
                self.toggle_mini_mode() # return to normal
        super().mousePressEvent(event)

    def toggle_mini_mode(self):
        self.is_mini_mode = not self.is_mini_mode
        
        if self.is_mini_mode:
            self.pre_mini_width = self.width()
            self.btn_folder.hide()
            self.btn_playlist.hide()
            self.btn_mini.hide()
            self.btn_prev.hide()
            self.btn_play.hide()
            self.btn_next.hide()
            self.progress_slider.hide()
            self.btn_volume.hide()
            self.btn_playmode.hide()
            self.playlist_widget.hide()
            
            # Using FramelessWindowHint and WindowStaysOnTopHint
            self.setWindowFlags(Qt.WindowType.WindowStaysOnTopHint | Qt.WindowType.FramelessWindowHint | Qt.WindowType.Tool)
            self.resize(150, 150)
            
            # Position bottom right
            screen = QApplication.primaryScreen().availableGeometry()
            self.move(screen.width() - self.width() - 20, screen.height() - self.height() - 20)
            
            if self.playlist:
                self.update_ui_for_song(self.playlist[self.current_index])
            else:
                self.title_label.setText("Click to restore")
                self.set_default_cover(130)
                
            self.show()
            
        else:
            # Restore normal mode
            self.btn_folder.show()
            self.btn_playlist.show()
            self.btn_mini.show()
            self.btn_prev.show()
            self.btn_play.show()
            self.btn_next.show()
            self.progress_slider.show()
            self.btn_volume.show()
            self.btn_playmode.show()
            
            self.setWindowFlags(self.original_flags)
            
            if hasattr(self, 'pre_mini_width') and self.pre_mini_width > 450:
                self.playlist_widget.show()
                self.resize(700, 500)
            else:
                self.resize(400, 500)
            
            if self.playlist:
                self.update_ui_for_song(self.playlist[self.current_index])
            else:
                self.title_label.setText("No Song Playing")
                self.set_default_cover(300)
                
            self.show()

    def closeEvent(self, event):
        if hasattr(self, 'player'):
            self.player.stop()
        QApplication.quit()
        event.accept()

if __name__ == "__main__":
    app = QApplication(sys.argv)
    player = MusicPlayer()
    player.show()
    sys.exit(app.exec())
