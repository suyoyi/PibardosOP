-- Owner-supplied custom art. Official OP12-020 metadata verified via the documented
-- OPTCG API /api/sets/card/OP12-020/ endpoint on 2026-10-15. No source image is copied.
-- Keep an immutable canonical base, shared/read-only through existing cards RLS.
insert into public.cards(id,user_id,card_number,name,colors,card_type,cost,power,counter,life,attribute,traits,effect_text,set_code,rarity,language,printing_code,canonical_card_id,source,provider_card_id,image_url,source_updated_at)
values('9bb1bfc0-cb7e-45ce-bde5-ed75656df3e8',null,'OP12-020','Roronoa Zoro (020)','{green}','leader',null,5000,null,5,'Slash',array['Straw Hat Crew Supernovas'],'[DON!! x3] [Activate: Main] [Once Per Turn] If this Leader battles your opponent''s Character during this turn, set this Leader as active. Then, this Leader cannot attack your opponent''s Characters with a base cost of 7 or less during this turn.','OP12','L','en','OP12-020','9bb1bfc0-cb7e-45ce-bde5-ed75656df3e8','optcgapi-catalog','optcg_sets_OP12-020','https://optcgapi.com/media/static/Card_Images/OP12-020_9afESv6.jpg','2026-10-14T00:00:00Z');

-- Copy rules/facts from the canonical base; customize only artwork/name/provenance.
insert into public.cards(id,user_id,card_number,name,colors,card_type,cost,power,counter,life,attribute,traits,effect_text,set_code,rarity,language,printing_code,canonical_card_id,source,source_updated_at)
select '3492c35f-0975-46a7-a35e-08b1be78f3e1',null,card_number,'Roronoa Vinny',colors,card_type,cost,power,counter,life,attribute,traits,effect_text,set_code,rarity,language,'custom-roronoa-vinny',id,'custom-artwork',source_updated_at
from public.cards where id='9bb1bfc0-cb7e-45ce-bde5-ed75656df3e8';
