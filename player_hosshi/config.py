import json
import os
import sys

# Save config in the user's home directory to avoid cluttering where the exe is placed
CONFIG_FILE = os.path.join(os.path.expanduser("~"), ".music_player_config.json")

def load_config():
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {"last_folder": ""}

def save_config(config_data):
    try:
        with open(CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(config_data, f, ensure_ascii=False, indent=4)
    except Exception as e:
        print(f"Failed to save config: {e}")
