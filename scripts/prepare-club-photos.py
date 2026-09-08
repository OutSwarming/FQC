"""Non-generative photo corrections approved by the user on September 7, 2026."""
from pathlib import Path
from PIL import Image, ImageOps, ImageEnhance, ImageFilter, ImageDraw
ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'output/club-photos/originals'
OUTPUT = ROOT / 'output/club-photos/enhanced'
OUTPUT.mkdir(parents=True, exist_ok=True)
ASSETS = ROOT / 'public/assets/hackathon'
# Crop only empty ceiling/floor margins; retain the original people and event content.
SETTINGS = {
 'full-room': ('jpg', (0, .16, 1, 1), 15, 1.025, .975, 1.055),
 'conversation': ('jpg', (0, .16, 1, 1), 15, 1.025, .975, 1.055),
 'workshop-room': ('jpg', (0, .28, 1, 1), 5, 1.018, .985, 1.035),
 'sign': ('webp', (.12, .19, .88, .90), 0, 1.0, 1.018, 1.02),
 'photonics': ('webp', (0, .08, 1, 1), 4, 1.0, 1.01, 1.02),
 'social': ('webp', (0, .15, 1, .96), 0, 1.0, 1.02, 1.02),
 'spring': ('webp', (0, .07, 1, .95), 0, 1.0, 1.01, 1.02),
}
comparison = Image.new('RGB', (1100, len(SETTINGS)*335), '#eeeeee')
draw = ImageDraw.Draw(comparison)
for row, (name, (ext, box, black, red, blue, saturation)) in enumerate(SETTINGS.items()):
 original=ImageOps.exif_transpose(Image.open(SOURCE/f'{name}.{ext}')).convert('RGB')
 w,h=original.size
 cropped=original.crop(tuple(round(v*(w if i%2==0 else h)) for i,v in enumerate(box)))
 # A single global black-point / gamma curve, then small white-balance correction.
 gamma=.94 if black else .96
 curve=[(max(0,(v-black)/(255-black)))**gamma*255 for v in range(256)]
 channels=cropped.split()
 edited=Image.merge('RGB', tuple(channel.point([round(min(255,value*gain)) for value in curve]) for channel,gain in zip(channels,[red,1,blue])))
 edited=ImageEnhance.Color(edited).enhance(saturation)
 # Gentle detail contrast and output sharpening, with no synthesized detail.
 edited=edited.filter(ImageFilter.UnsharpMask(radius=20,percent=12,threshold=6))
 edited.save(OUTPUT/f'{name}-enhanced.jpg', quality=95, subsampling=0)
 for size in [800,1600]:
  web=edited.copy(); web.thumbnail((size,size*2),Image.Resampling.LANCZOS)
  web=web.filter(ImageFilter.UnsharpMask(radius=.7,percent=45,threshold=3))
  web.save(ASSETS/f'{name}-enhanced-{size}.webp',quality=85,method=6)
 for col,im in enumerate([cropped,edited]):
  preview=im.copy();preview.thumbnail((540,300));comparison.paste(preview,(col*550,row*335))
  draw.text((col*550+8,row*335+307),name+(' / original crop' if col==0 else ' / corrected'),fill='#111111')
comparison.save(OUTPUT/'comparison.jpg',quality=90)
print('Saved seven non-generative edits and responsive WebP versions')
