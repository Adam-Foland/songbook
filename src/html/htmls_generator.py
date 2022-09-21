import os
import shutil

import src.html.create_songs_html as cash


def main():
    target_dir = os.path.join("..", "..", "build")
    src = os.path.join("..", "..", "songs")
    path_songs_html = os.path.join(target_dir, "songs_html")
    if os.path.exists(path_songs_html):
        shutil.rmtree(path_songs_html)
        os.mkdir(path_songs_html)
    cash.create_all_songs_html(src, src, path_songs_html)


if __name__ == "__main__":
    main()
