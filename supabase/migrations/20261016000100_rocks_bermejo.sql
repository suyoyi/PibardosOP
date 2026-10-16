-- Owner-supplied artwork. OP17-039 reference metadata verified from the documented
-- OPTCG API /api/sets/card/OP17-039/ endpoint on 2026-10-16. No provider image is copied.
insert into public.cards(id,user_id,card_number,name,colors,card_type,cost,power,counter,life,attribute,traits,effect_text,set_code,rarity,language,printing_code,canonical_card_id,source,provider_card_id,image_url,source_updated_at)
values('e297b3be-ea1e-46c7-9850-7af237c09221',null,'OP17-039','Rocks.D.Xebec (039)','{blue}','leader',null,5000,null,5,'Slash',array['Rocks Pirates'],'[When Attacking] You may trash 1 card from your hand: Reveal 1 card from the top of your deck. If the revealed card''s type includes "Rocks Pirates", draw 2 cards.','OP17','L','en','OP17-039','e297b3be-ea1e-46c7-9850-7af237c09221','optcgapi-catalog','optcg_sets_OP17-039','https://optcgapi.com/media/static/Card_Images/OP17-039_pZKVdpd.jpg','2026-10-16T00:00:00Z');

-- The fan display collection is separate from immutable official set/rules metadata.
insert into public.cards(id,user_id,card_number,name,colors,card_type,cost,power,counter,life,attribute,traits,effect_text,set_code,rarity,language,printing_code,canonical_card_id,source,source_updated_at)
select 'db196a52-a889-4d04-8d93-34dddde3f7fc',null,card_number,'Rocks D. Bermejo',colors,card_type,cost,power,counter,life,attribute,traits,effect_text,set_code,rarity,language,'custom-rocks-d-bermejo',id,'custom-artwork',source_updated_at
from public.cards where id='e297b3be-ea1e-46c7-9850-7af237c09221';
