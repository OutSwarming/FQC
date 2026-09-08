"""Stronger, non-generative lens-haze correction from the original photographs."""
from pathlib import Path
from PIL import Image,ImageOps,ImageChops,ImageFilter,ImageMath,ImageEnhance,ImageDraw
ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'output/club-photos/originals'
OUT=ROOT/'output/club-photos/clear-4k';OUT.mkdir(parents=True,exist_ok=True)
ASSETS=ROOT/'public/assets/hackathon'
SETTINGS={'full-room':(.75,(0,.16,1,1)),'conversation':(.75,(0,.16,1,1)),'workshop-room':(.25,(0,.28,1,1))}
contact=Image.new('RGB',(1200,3*415),'#eeeeee');draw=ImageDraw.Draw(contact)
for row,(name,(strength,box)) in enumerate(SETTINGS.items()):
 source=ImageOps.exif_transpose(Image.open(SOURCE/f'{name}.jpg')).convert('RGB');w,h=source.size
 source=source.crop(tuple(round(v*(w if i%2==0 else h)) for i,v in enumerate(box)))
 # Estimate the veil locally from the darkest RGB channel; smooth the estimate to avoid halos.
 small=source.copy();small.thumbnail((500,500));r,g,b=small.split()
 dark=ImageChops.darker(ImageChops.darker(r,g),b).filter(ImageFilter.MinFilter(15)).filter(ImageFilter.GaussianBlur(8)).resize(source.size,Image.Resampling.BILINEAR)
 transmission=dark.point(lambda v:round(max(.48,1-strength*v/240)*255)).convert('F')
 result=Image.merge('RGB',tuple(ImageMath.unsafe_eval("convert((band-240)*255/t+240,'L')",band=band.convert('F'),t=transmission) for band in source.split()))
 curve=[255*((v/255)**.92) for v in range(256)]
 result=Image.merge('RGB',tuple(band.point([round(min(255,v*gain)) for v in curve]) for band,gain in zip(result.split(),[1.02,1,.985])))
 result=ImageEnhance.Color(result).enhance(1.04)
 result=result.filter(ImageFilter.UnsharpMask(radius=source.width/60,percent=20,threshold=4))
 # Export at a 3840-pixel long edge; resample the tighter portrait crop without synthesized detail.
 scale=3840/max(result.size)
 master=result.resize((round(result.width*scale),round(result.height*scale)),Image.Resampling.LANCZOS)
 master=master.filter(ImageFilter.UnsharpMask(radius=.8,percent=60,threshold=3));master.save(OUT/f'{name}-4k.jpg',quality=96,subsampling=0)
 for width in [800,1600,2400]:
  web=result.copy();web.thumbnail((width,width*2),Image.Resampling.LANCZOS);web=web.filter(ImageFilter.UnsharpMask(radius=.65,percent=50,threshold=3))
  web.save(ASSETS/f'{name}-clear-{width}.webp',quality=87,method=6)
 for col,img in enumerate([source,result]):
  thumb=img.copy();thumb.thumbnail((590,380));contact.paste(thumb,(col*600,row*415))
  draw.text((col*600+6,row*415+389),f'{name} / '+('original' if col==0 else 'dehazed'),fill='#111111')
 print(name,master.size)
contact.save(OUT/'before-after.jpg',quality=92)
