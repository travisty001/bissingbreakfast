# Guest ordering room backgrounds (V3 preview)

Three room-specific photographs were selected from the property's official 2025 galleries at https://bissinghouse.com/accommodations/. These are bundled locally (WebP) rather than hotlinked, so the app does not rely on an external image server at runtime. The existing background JPGs are retained for easy rollback.

| Room | Original official photograph | Native dimensions | Optimized local asset |
| --- | --- | --- | --- |
| Bissing | https://bissinghouse.com/wp-content/uploads/2025/06/bed1-1.jpg | 3060 × 4080 | public/room-backgrounds/bissing-suite-2025.webp |
| Basgall | https://bissinghouse.com/wp-content/uploads/2025/06/bed1-scaled.jpg | 1920 × 2560 | public/room-backgrounds/basgall-suite-2025.webp |
| Tea Rose | https://bissinghouse.com/wp-content/uploads/2025/06/trbed1.png | 1171 × 1562 | public/room-backgrounds/tea-rose-suite-2025.webp |

Tea Rose's 2025 photo is lower in total pixel count than the previous 1920 × 1440 landscape JPG but depicts the room's newer decor, is sharp at its native resolution, and fits phone screens better; it has not been artificially upscaled. For Bissing and Basgall the portrait photographs also reflect the newer bedroom arrangements.

No guest order or SMS behavior was changed.
