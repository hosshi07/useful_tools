import os
from mutagen import File
from mutagen.id3 import ID3, APIC
from mutagen.mp4 import MP4, MP4Cover
from mutagen.flac import FLAC

def get_metadata(filepath):
    """
    Returns a dictionary:
    {
        "title": str,
        "cover_data": bytes or None
    }
    """
    metadata = {
        "title": os.path.basename(filepath),
        "cover_data": None
    }
    
    try:
        audio = File(filepath)
        if audio is None:
            return metadata

        # Extract Title
        if "TIT2" in audio:
            metadata["title"] = str(audio["TIT2"])
        elif "title" in audio:
            metadata["title"] = audio["title"][0] if isinstance(audio["title"], list) else str(audio["title"])
        elif "©nam" in audio:
            metadata["title"] = audio["©nam"][0] if isinstance(audio["©nam"], list) else str(audio["©nam"])

        # Extract Cover Art
        if hasattr(audio, "tags") and audio.tags:
            # MP3 (ID3)
            if isinstance(audio.tags, ID3):
                for tag in audio.tags.values():
                    if isinstance(tag, APIC):
                        metadata["cover_data"] = tag.data
                        break
            # FLAC
            elif isinstance(audio, FLAC):
                if audio.pictures:
                    metadata["cover_data"] = audio.pictures[0].data
            # M4A (MP4)
            elif isinstance(audio, MP4):
                if "covr" in audio.tags:
                    covers = audio.tags["covr"]
                    if covers and len(covers) > 0:
                        metadata["cover_data"] = bytes(covers[0])

    except Exception as e:
        print(f"Error reading metadata for {filepath}: {e}")

    return metadata
