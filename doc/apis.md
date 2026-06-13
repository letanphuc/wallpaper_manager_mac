# Peapix API

## Bing API

`https://peapix.com/bing/feed`

Returns Bing daily wallpapers. Data is cached for 30 minutes.

### Parameters

| Param | Description |
|-------|-------------|
| `country` | Bing region code. Accepted: `au br ca cn de fr in it jp es gb us` |
| `n` | Number of images to return (default: 7, a rolling week) |

### Example

```
GET https://peapix.com/bing/feed?country=jp
```

### Response

```json
[{
    "title": "太湖の桜, 中国 江蘇省",
    "copyright": "© Eric Yang/Getty Image",
    "fullUrl": "https://img.peapix.com/<id>_1920.jpg",
    "thumbUrl": "https://img.peapix.com/<id>_640.jpg",
    "imageUrl": "https://img.peapix.com/<id>.jpg",
    "pageUrl": "https://peapix.com/bing/<num>",
    "date": "2022-04-03"
}]
```

### Notes

- Different `country` values return different regional image sets.
- Same country returns the same data within the 30-minute cache window.
- Returns the last 7 days of Bing wallpapers (rolling window).

## Spotlight API

`https://peapix.com/spotlight/feed`

Returns Windows Spotlight lock screen wallpapers. Data is cached for 30 minutes.

### Parameters

| Param | Description |
|-------|-------------|
| `n` | Number of images to return (default: ~7) |

### Example

```
GET https://peapix.com/spotlight/feed
```

### Response

```json
[{
    "title": "A marina alight",
    "copyright": "© Jonathan Chiang/Scintt/Moment/Getty Images",
    "fullUrl": "https://img.peapix.com/<id>_1920.jpg",
    "thumbUrl": "https://img.peapix.com/<id>_640.jpg",
    "imageUrl": "https://img.peapix.com/<id>.jpg",
    "pageUrl": "https://peapix.com/spotlight/<num>-<slug>"
}]
```

### Notes

- No `country` parameter — global images.
- `pageUrl` format: `https://peapix.com/spotlight/<id>-<slugified-title>`

## Image URL variants (both APIs)

Given an image ID (e.g. `7fabb258a33c49d583bd1506f0cbc451`):

| Suffix | Resolution | Size |
|--------|------------|------|
| `<id>_640.jpg` | 640px (thumb) | ~50 KB |
| `<id>_1920.jpg` | 1920px (full) | ~350 KB |
| `<id>_3840.jpg` | **3840×2160 (4K)** | ~1.6 MB |
| `<id>.jpg` | **3840×2160 (4K, less compressed)** | ~3.5 MB |
