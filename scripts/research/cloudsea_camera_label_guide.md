# Sonnblick camera visual truth protocol

This is a prediction-blind development cohort, not empirical probability
calibration or a holdout result. Do not open forecast, score, or algorithm output
while annotating. September 1–30, 2026 local 08:00, 11:00, 14:00, 17:00 were fixed
before looking at these images: at most 120 distinct public camera previews.
August and October 11–20 remain sealed until the parent freezes a candidate.

Camera: Sonnblick Observatory, 47.053979 N, 12.957484 E, 3106 m, heading 200 degrees
towards the Moelltal and Lienzer Dolomiten. Camera identity and usage terms:
https://www.foto-webcam.eu/webcam/sonnblick/infos/ .

## Time and provenance

Keep the official filename local clock, archive page URL, requested image URL,
HTTP status, Last-Modified GMT, image SHA256, image dimensions, helper SHA256 and
repository SHA with every receipt. Official archive/exif metadata and three
development image headers support a +02:00 clock offset. Thus the selected slots
correspond to UTC 06:00, 09:00, 12:00 and 15:00. This is an explicit source-header
supported inference, not an embedded EXIF assertion. HTTP Last-Modified is asset
write time, not shutter time. The helper requires a nonnegative 0–120 second
source-write delta for each file. Missing or inconsistent headers leave inferred
UTC null and clock UNVERIFIED. Such observations remain UNKNOWN for matching.

## Labels

- **POSITIVE:** a broad, spatially coherent cloud deck is visibly below the
  camera, with unobscured foreground mountain relief establishing that the
  observer is above it. A small isolated wisp, distant bright patch, ambiguous
  cloud height or cloud entirely behind a ridge is insufficient.
- **NEGATIVE / fog_enclosed:** the camera is clearly enclosed in atmospheric fog,
  and foreground evidence distinguishes it from ice, snow, moisture or dirt on
  the lens/window. If those cannot be distinguished, use UNKNOWN.
- **NEGATIVE / visible_terrain_no_broad_cloudsea:** the field of view clearly
  shows mountain/valley terrain without a broad cloud deck below the camera.
  A visibly clear foreground with only high/distant clouds may qualify.
- **UNKNOWN:** partial or uncertain views, unclear deck height, lens/window ice,
  snow, rain/moisture obstruction, exposure failure, night/darkness, missing data,
  unverified source clock, or any case that does not meet a determinate rule.

Record `id`, `image_sha256`, `label`, `reason`, `confidence` (high/medium/low),
`subtype`, `annotator` and `reviewed_utc` in the external `labels.json`. Reasons
must describe visible evidence; never substitute cloud base, METAR, humidity,
forecast score or expected weather. Missing days are never negative events.
Prefer UNKNOWN over weak determinate labels. These are assistant visual labels,
not independent human adjudication. A single SW-facing camera says nothing about
unobserved directions. Keep visible cloud-deck truth distinct from photographic
quality, beauty and a station's cloud-base report.

## Public access and storage

Download one public `.../2026/09/DD/HHMM_la.jpg` at a time, at least two seconds
between requests. Stop on HTTP 401, 403 or 429; do not bypass an access gate.
Do not call the protected ZIP/download.php feature. The official daily ZIP
documentation requires valid login for that feature and analogously describes
individual images from password-protected cameras; this does not establish a
blanket prohibition on public individual image access:
https://www.foto-webcam.eu/webcam/doku/autodownload.php .

Source credit: https://www.foto-webcam.eu/webcam/sonnblick/ . Preserve original
files, aspect ratios, watermarks and source links. Contact sheets retain each
whole preview, without cropping, and show source credit. Public images and local
labels remain under the approved external directory and are not published raw
to GitHub. Local analysis does not expand publication or reuse rights.

## Commands and helper API

Run from the repository root with Python and Pillow:

```powershell
python scripts/research/cloudsea_camera_download.py download --start-day 1 --end-day 5
python scripts/research/cloudsea_camera_download.py contacts --start-day 1 --end-day 5
# Continue days 6-30 only after the first twenty images and clocks are reviewed.
python scripts/research/cloudsea_camera_download.py download --start-day 6 --end-day 30
python scripts/research/cloudsea_camera_download.py contacts --start-day 6 --end-day 30
python scripts/research/cloudsea_camera_download.py validate-labels
```

Importable API: `cohort`, `clock_evidence`, `download`, `contacts`,
`validate_labels`. Outputs are `predeclared-cohort.json`, `manifest.json`, JPEGs,
contact sheets and manual `labels.json`, all under
`E:/Claude_allow/Download/starphoto-dense-cohort-20261025/camera-development/`.
Resuming checks exact image hashes. Failures remain explicit receipts.
