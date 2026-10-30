/**
 * Moteur des « Rencontres vivantes » Underdark (kit V1, integration/browser-core.mjs), repris tel quel.
 * Pur, sans réseau ni accès disque : classification des lieux, règles d'association, tirage déterministe.
 * Données : src/encounters/data/*.json. Documentation : docs/underdark/.
 */
export function createEncounterCore({policy, taxonomy, templates, creatureRefs, canonLocations, npcArchetypes}) {
  const POLICY=policy;
  const TAX=taxonomy;
  const TEMPLATES=Array.isArray(templates)?templates:templates.encounters;
  const CREATURE_REFS=Array.isArray(creatureRefs)?creatureRefs:creatureRefs.references;
  const canon=Array.isArray(canonLocations)?canonLocations:canonLocations.locations;
  const NPC_ARCHETYPES=Array.isArray(npcArchetypes)?npcArchetypes:npcArchetypes.archetypes;
function fold(s='') { return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[’]/g,"'"); }
function safeSlug(s='') { return fold(s).replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,40)||'x'; }
function unique(xs) { return [...new Set(xs.filter(Boolean))]; }

const CATEGORY_HINTS = { cite:['urban','residential'], sanctuaire:['religious'], grotte:['cave'], voie:['route'], eau:['aquatic'], danger:['hazard'], ressource:['resource'], vivant:['ecology'], evenement:['historic'], institution:['civic'], ruine:['ruins'], garde:['checkpoint'], indetermine:['unknown'] };

function inferZone(tags) {
  if (tags.includes('surface')) return 'surface';
  if (tags.some(t=>['urban','market','residential','scholar','forge','religious'].includes(t))) return 'cite';
  if (tags.some(t=>['route','checkpoint','portals'].includes(t))) return 'transit';
  return 'sauvage';
}
function tagsFor(name, category, extra=[]) {
  let tags=[...(CATEGORY_HINTS[category]||[]),...extra]; const text=fold(name);
  for(const [tag,words] of Object.entries(TAX.keywords)) if(words.some(word=>text.includes(fold(word)))) tags.push(tag);
  if(tags.includes('surface')) tags.push('checkpoint');
  return unique(tags);
}
function ownerFor(people='') { const p=fold(people); if(p.includes('mori'))return 'moriquendi';if(p.includes('duergar'))return 'duergar'; if(p.includes('drow'))return 'drow';if(p.includes('svirf'))return 'svirfneblin';if(p.includes('myconi'))return 'myconide';if(p.includes('gobelin'))return 'gobelin';if(p.includes('kobold'))return 'kobold';return null; }
const SPECIAL_SITE_OWNERS={ 'hosten-valak':{owner:'moriquendi',clan:'Warral'},'cite-khordun':{owner:'duergar'},'cite-kharaz-dumel':{owner:'duergar'} };
const byIdCanon = new Map(canon.map(x=>[x.id,x]));
const byEntryCanon = new Map(canon.filter(x=>x.entryId).map(x=>[x.entryId,x]));
const REFS_BY_ID = new Map(CREATURE_REFS.map(x=>[x.id,x]));

/** Exporte un lieu de n'importe quelle collection Atlas, sans inventer les coordonnées. */
function classifyFeature(feature, atlas, indexes={}) {
  const geos=indexes.geometriesByFeature?.get(feature.id)??(atlas.geometries||[]).filter(g=>g.featureId===feature.id);
  const mapIndex = indexes.mapsById??new Map((atlas.maps||[]).map(m=>[m.id,m]));
  const guessedSites = geos.map(g=>mapIndex.get(g.mapId)?.scope?.id).filter(Boolean);
  const site=guessedSites.find(x=>SPECIAL_SITE_OWNERS[x]);
  const known=byIdCanon.get(feature.id)||byEntryCanon.get(feature.entryId);
  const owner=known?.owner??ownerFor(feature.people)??SPECIAL_SITE_OWNERS[site]?.owner??null;
  const clan=known?.clan??SPECIAL_SITE_OWNERS[site]?.clan??null;
  const tags=tagsFor(feature.title,feature.category,[...(known?.tags||[]),...(owner==='moriquendi'?['moriquendi_territory']:[])]);
  const isDemo=feature.demo===true || feature.placementStatus==='illustrative'&&feature.canonStatus!=='confirme';
  const atlasHosten=guessedSites.includes('hosten-valak');
  const placement=known?.placement??feature.placementStatus??'unknown';
  const mapPositionDocumented=Boolean(geos.length)&&placement==='documented'&&feature.canonStatus==='confirme'&&!isDemo;
  return {id:feature.id,entryId:feature.entryId??null,name:feature.title,category:feature.category,
    source:'src/atlas/data.ts -> ATLAS.features (incl. enrichment)',sourceKind:isDemo?'atlas_demo':'atlas',
    sourceStatus:feature.canonStatus??'creation',placementStatus:placement,placedOnAtlas:geos.length>0,
    mapPositionDocumented,geometry:geos.map(g=>({mapId:g.mapId,type:g.type,coordinates:g.coordinates})),
    mapIds:unique(geos.map(g=>g.mapId)),scopeIds:unique(guessedSites),owner,clan,zone:inferZone(tags),
    tags,traffic:'unknown',security:'unknown',currentWar:'unknown',
    allowVisitors: owner==='moriquendi'?'exceptional':'unresolved',
    sourceNote:known?.note||null,relativePosition:known?.relativePosition||null,
    needsReview:Boolean(known?.needsReview)||isDemo||atlasHosten||(!known&&feature.canonStatus!=='confirme'),
    scenarioOnly: isDemo||feature.canonStatus!=='confirme', 
    eligibilityStatus: isDemo?'DEMO_NOT_CANON':known?.needsReview?'CANON_SOURCE_CONFLICT':atlasHosten?'ATLAS_SOURCE_REVIEW':feature.canonStatus==='confirme'?'CANON_OR_SOURCE_CONFIRMED':'PROPOSAL'};
}
/** Reprend les lieux explicites du Tome II s'ils sont absents des points Atlas. */
function classifyCanonPlace(c) {
  const tags=tagsFor(c.name,c.category,c.tags||[]);
  return {id:c.id,entryId:c.entryId,name:c.name,category:c.category,
    source:'Tome II (canon confirmed)',sourceKind:'canon_external',sourceStatus:'confirme',placementStatus:c.placement,
    placedOnAtlas:false,mapPositionDocumented:false,geometry:[],mapIds:[],scopeIds:[],
    owner:c.owner,clan:c.clan??null,zone:inferZone(tags),tags,traffic:'unknown',security:'unknown',currentWar:'unknown',
    allowVisitors:c.owner==='moriquendi'?'exceptional':'unresolved',relativePosition:c.relativePosition||null,
    sourceNote:c.note||null,needsReview:Boolean(c.needsReview),scenarioOnly:false,
    eligibilityStatus:c.needsReview?'CANON_SOURCE_CONFLICT':'CANON_OR_SOURCE_CONFIRMED'};
}
/** Cités publiées via public/data/cites/index.json. Préserver 'creation' ≠ canon. */
function classifyPublishedCity(city) {
  const cat='cite',owner=ownerFor(city.peuple),id=`cite-${city.id}`,isDraft=Boolean(city.__loreSmithDraft);
  const base={id,name:city.nom,entryId:null,category:cat,
    source:isDraft?`exported-draft:${city.id}`:`public/data/cites/${city.id}.json`,sourceKind:isDraft?'local_draft':'published_city',sourceStatus:city.statut||'creation',
    placementStatus:city.position?.precision==='approximative'?'approximate':'unknown',
    placedOnAtlas:Boolean(city.position?.strate),mapPositionDocumented:false,
    geometry:[],mapIds:[],scopeIds:[id],owner,clan:null,traffic:'unknown',security:'unknown',currentWar:'unknown',
    tags:tagsFor(city.nom,cat,[...(owner==='moriquendi'?['moriquendi_territory']:[])]),zone:'cite',
    allowVisitors:owner==='moriquendi'?'exceptional':'unresolved',relativePosition:null,
    sourceNote:`Dossier cité publiée, statut ${city.statut||'creation'}; coordonnées internes illustratives`,
    needsReview:isDraft||city.statut!=='confirme',scenarioOnly:isDraft||city.statut!=='confirme',
    eligibilityStatus:city.statut==='confirme'?'ATLAS_SOURCE_ONLY':'PROPOSAL',positionFromCity:city.position||null};
  const places=[base];
  for(let i=0;i<(city.paliers||[]).length;i++){
    const palier=city.paliers[i];
    const floorId=`${id}-p${i}`;
    places.push({...base,id:floorId,name:`${city.nom} — ${palier.nom}`,tags:tagsFor(palier.nom,'cite',base.tags),scopeIds:[id,floorId],parentId:id,level:'floor',placementStatus:'illustrative',placedOnAtlas:false,positionFromCity:null});
    for(const p of palier.lieux||[]){
      const alias={mine:'ressource',forge:'ressource',temple:'sanctuaire',elevage:'vivant',ferme:'vivant',marche:'ressource',commerce:'ressource',militaire:'garde',caserne:'garde',administration:'institution',ecole:'institution',archives:'institution',habitation:'cite',porte:'cite',quartier:'cite',place:'cite',pont:'voie',hydraulique:'eau',taverne:'ressource'};
      const pcat=alias[fold(p.categorie||'')]||p.categorie||'cite';
      const tags=tagsFor(p.nom,pcat,owner==='moriquendi'?['moriquendi_territory']:[]);
      places.push({...base,id:`${id}-${i}-${safeSlug(p.nom)}`,name:p.nom,category:pcat,parentId:floorId,level:'place',scopeIds:[id,floorId],tags,
        zone:inferZone(tags),geometry:p.x!=null&&p.y!=null?[{mapId:`carte-${floorId}`,type:'point',coordinates:[p.x,p.y]}]:[],
        placedOnAtlas:true,placementStatus:'illustrative',mapPositionDocumented:false,positionFromCity:null});
    }
  }
  return places;
}

/** Context hierarchy, NOT point geometry. Each has a profile usable in campaign planners. */
function classifyAtlasContexts(atlas){
  const out=[]; const mapsById=new Map((atlas.maps||[]).map(m=>[m.id,m]));
  for(const s of atlas.spaces||[]){
    const parentSite=s.siteId||s.parentSpaceId||s.id;
    const knownOwner=SPECIAL_SITE_OWNERS[parentSite]||SPECIAL_SITE_OWNERS[s.id]||{};
    const demo=Boolean(s.demo)||String(s.id).includes('essai');
    const category=s.kind==='entre-strate'?'voie':s.kind==='secteur'?'grotte':'cite';
    const tags=tagsFor(s.name,category,[...(knownOwner.owner==='moriquendi'?['moriquendi_territory']:[])]);
    out.push({id:`atlas-space:${s.id}`,name:s.name,entryId:null,category,source:'ATLAS.spaces',sourceKind:'atlas_space',sourceStatus:demo?'creation':'atlas_context',
      placementStatus:demo?'illustrative':'unknown',placedOnAtlas:Boolean(s.mapId),mapPositionDocumented:false,
      geometry:[],mapIds:s.mapId?[s.mapId]:[],scopeIds:unique([s.id,s.siteId,s.parentSpaceId]),owner:knownOwner.owner||null,clan:knownOwner.clan||null,
      zone:inferZone(tags),tags,traffic:'unknown',security:'unknown',currentWar:'unknown',allowVisitors:knownOwner.owner==='moriquendi'?'exceptional':'unresolved',
      sourceNote:'Contexte topologique de l Atlas, non un point géolocalisé',relativePosition:null,needsReview:true,scenarioOnly:demo,
      eligibilityStatus:demo?'DEMO_NOT_CANON':'ATLAS_CONTEXT_NO_GEO',parentId:s.parentSpaceId||s.siteId||null});
  }
  for(const st of atlas.strata||[]){
    const demo=Boolean(st.demo)||st.id.startsWith('n1-strate-');
    const tags=['cave','ecology','route'];
    out.push({id:`atlas-stratum:${st.id}`,name:st.title,entryId:null,category:'grotte',source:'ATLAS.strata',sourceKind:'atlas_stratum',sourceStatus:'convention_de_travail',
      placementStatus:'unknown',placedOnAtlas:Boolean(st.mapId),mapPositionDocumented:false,geometry:[],mapIds:st.mapId?[st.mapId]:[],scopeIds:[st.id],owner:null,clan:null,
      zone:'sauvage',tags,traffic:'unknown',security:'unknown',currentWar:'unknown',allowVisitors:'unresolved',sourceNote:'Strate de classement; conventions de travail ne donnent pas controle territorial',
      needsReview:true,scenarioOnly:demo,eligibilityStatus:demo?'DEMO_NOT_CANON':'ATLAS_CONTEXT_NO_GEO'});
  }
  for(const map of atlas.maps||[]){
    const siteId=map.scope?.id||null,ownerKnown=SPECIAL_SITE_OWNERS[siteId]||{},kind=map.scope?.kind;
    const demo=Boolean(map.demo),category=kind==='site'?'cite':kind==='espace'?'voie':'grotte';
    const tags=tagsFor(map.title,category,[...(ownerKnown.owner==='moriquendi'?['moriquendi_territory']:[])]);
    out.push({id:`atlas-map:${map.id}`,name:map.title,entryId:null,category,source:'ATLAS.maps',sourceKind:'atlas_map_context',sourceStatus:demo?'creation':'atlas_context',
      placementStatus:demo?'illustrative':'unknown',placedOnAtlas:true,mapPositionDocumented:false,geometry:[],mapIds:[map.id],scopeIds:unique([siteId,map.scope?.floorId]),
      owner:ownerKnown.owner||null,clan:ownerKnown.clan||null,zone:inferZone(tags),tags,traffic:'unknown',security:'unknown',currentWar:'unknown',
      allowVisitors:ownerKnown.owner==='moriquendi'?'exceptional':'unresolved',sourceNote:'Carte = contexte, ne vaut pas coordonnées physiques',needsReview:true,
      scenarioOnly:demo,eligibilityStatus:demo?'DEMO_NOT_CANON':'ATLAS_CONTEXT_NO_GEO'});
  }
  return out;
}
/** Conserver atlas + cités publiées + canon connu mais non localisé. */
function buildInventory(atlas={features:[],maps:[],geometries:[],connections:[],anchors:[]}, cities=[]) {
  // 'Les Palissades' is a collective concept, not a sixth geolocatable city.
  const nonPlaces=new Set(['lieu-palissades']);
  const geometriesByFeature=new Map();
  for(const geo of atlas.geometries||[]){if(!geometriesByFeature.has(geo.featureId))geometriesByFeature.set(geo.featureId,[]);geometriesByFeature.get(geo.featureId).push(geo);}
  const mapsById=new Map((atlas.maps||[]).map(m=>[m.id,m]));
  const places=(atlas.features||[]).filter(f=>!nonPlaces.has(f.id)).map(f=>classifyFeature(f,atlas,{geometriesByFeature,mapsById}));
  const ids=new Set(places.map(x=>x.id));
  for(const p of classifyAtlasContexts(atlas)){if(!ids.has(p.id)){places.push(p);ids.add(p.id);}}
  for(const city of cities){for(const p of classifyPublishedCity(city)){if(!ids.has(p.id)){places.push(p);ids.add(p.id);}}}
  const existingEntry=new Set(places.map(x=>x.entryId).filter(Boolean));
  for(const c of canon){if(!ids.has(c.id)&&!existingEntry.has(c.entryId)){places.push(classifyCanonPlace(c));ids.add(c.id);}}
  // Non-lieux comme un ensemble conceptuel de 5 Palissades restent hors des lieux géographiques.
  const anchors=new Map((atlas.anchors||[]).map(x=>[x.id,x]));
  const routes=(atlas.connections||[]).map(c=>({id:c.id,title:c.title,kind:c.kind,direction:c.direction,
    fromMapId:anchors.get(c.fromAnchorId)?.mapId||null,toMapId:anchors.get(c.toAnchorId)?.mapId||null,
    sourceStatus:c.canonStatus,placementStatus:c.placementStatus,isDemo:Boolean(c.demo),
    hazard:(c.hazards||[]),difficulty:c.difficulty??null}));
  const mapIndex=new Map((atlas.maps||[]).map(x=>[x.id,x]));
  for(const route of routes){
    const ends=[route.fromMapId,route.toMapId].map(id=>SPECIAL_SITE_OWNERS[mapIndex.get(id)?.scope?.id]);
    const owner=ends[0]?.owner&&ends[0].owner===ends[1]?.owner?ends[0].owner:null;
    const clan=ends[0]?.clan&&ends[0].clan===ends[1]?.clan?ends[0].clan:null;
    const tags=tagsFor(route.title,'voie',[...(route.hazard.length?['hazard']:[]),...(route.kind==='portail'?['portals']:[]),...(owner==='moriquendi'?['moriquendi_territory']:[])]);
    const loc={id:`atlas-route:${route.id}`,name:route.title,category:'voie',entryId:null,source:'ATLAS.connections',sourceKind:'atlas_connection',
      sourceStatus:route.sourceStatus||'creation',placementStatus:route.placementStatus||'unknown',placedOnAtlas:true,mapPositionDocumented:false,
      geometry:[],mapIds:unique([route.fromMapId,route.toMapId]),scopeIds:[],owner,clan,zone:'transit',tags,
      traffic:'unknown',security:'unknown',currentWar:'unknown',allowVisitors:owner==='moriquendi'?'exceptional':'unresolved',
      sourceNote:'Topologie du trajet seulement; temps de parcours non déduit',needsReview:route.isDemo||route.placementStatus!=='documented',
      scenarioOnly:route.isDemo,eligibilityStatus:route.isDemo?'DEMO_NOT_CANON':'ATLAS_ROUTE_CONTEXT'};
    if(!ids.has(loc.id)){places.push(loc);ids.add(loc.id);}
  }
  return {schema:'loresmith-atlas-encounter-places-v1',atlasVersion:atlas.version||'published_cities_only',
    sourceStatus:'extraction_atlas_plus_sources',generatedAt:new Date().toISOString(),
    counts:{total:places.length,atlas:places.filter(p=>p.sourceKind==='atlas'||p.sourceKind==='atlas_demo').length,atlasContexts:places.filter(p=>['atlas_space','atlas_map_context','atlas_stratum'].includes(p.sourceKind)).length,cityPublished:places.filter(p=>p.sourceKind==='published_city').length,cityDrafts:places.filter(p=>p.sourceKind==='local_draft').length,
      atlasConnections:places.filter(p=>p.sourceKind==='atlas_connection').length,
      canonExternal:places.filter(p=>p.sourceKind==='canon_external').length,needsReview:places.filter(p=>p.needsReview).length},locations:places,routes};
}

/** Les interdits culturels sont des contraintes bloquantes AVANT les pondérations. */
function validateComposition(template, location, options={}) {
  const reasons=[], members=template.groupMembers||[];
  const actorFactions=unique(members.map(m=>m.species)).filter(s=>s!=='fauna');
  const hasMori=actorFactions.includes('moriquendi')||template.faction==='moriquendi';
  const refById=REFS_BY_ID;
  const hasOutsider=actorFactions.some(s=>s!=='moriquendi');
  if(!hasMori && actorFactions.length>1 && !template.associationJustification?.description) reasons.push('ASSOCIATION_INTERPEUPLES_NON_JUSTIFIEE');
  const leader=members.find(m=>m.relationToLeader==='leader')||members[0];
  if(['trade','caravan','diplomatic','social'].includes(template.kind) && leader?.creatureId && (refById.get(leader.creatureId)?.sentience??5)<3)
    reasons.push('CREATURE_NON_SAPIENTE_NE_PAS_DIRIGER_COMMERCE_OU_DIPLOMATIE');
  const approved=template.exceptionId&&options.approvedExceptions?.[template.exceptionId];
  const approvedNamed=Boolean(approved?.enabled===true&&approved.approvedBy&&approved.namedLeader&&approved.rationale&&approved.namedLeader!=="REMPLACER_POUR_UNE_PERSONNE_NOMMEE_PAR_LE_MJ");
  if(template.groupCategory==='named_exception'&&!approvedNamed) reasons.push('EXCEPTION_NON_APPROUVEE: nom du leader, motif et validation MJ requis');
  if(hasMori && hasOutsider){
    if(!leader||leader.species!=='moriquendi') reasons.push('MORI_SOUS_AUTORITE_EXTERNE_INTERDIT');
    if(!approvedNamed) reasons.push('MORI_MIXTE_NON_AUTORISE_PAR_DEFAUT');
  }
  if(members.some(m=>m.species==='moriquendi'&&m!==leader&&['servant','employee','subordinate','captive','coerced_labor'].includes(m.relationToLeader)&&leader?.species!=='moriquendi'))
    reasons.push('MORI_SERVITEUR_D_UN_AUTRE_PEUPLE_INTERDIT');
  if(location){
    // Fauna, signs and hazards can exist in Mori territory: border restrictions apply to peoples, not ecology.
    const isNonSocial = template.faction==='fauna'||(!members.length&&['sign','hazard','exploration','ecology'].includes(template.kind));
    if(location.owner==='moriquendi'&&template.faction!=='moriquendi'&&!isNonSocial&&!options.allowedForeignVisits?.includes(template.id)) reasons.push('TERRITOIRE_MORI_VISITEURS_NON_AUTORISES');
    if(template.faction==='moriquendi'&&location.owner!=='moriquendi'&& !location.tags?.includes('moriquendi_route') && !options.allowMoriExternal && !approvedNamed) reasons.push('MORI_HORS_TERRITOIRE_NON_AUTORISE_PAR_DEFAUT');
    if(template.locationTags?.length&&!template.locationTags.some(t=>location.tags?.includes(t)))reasons.push('BIOME_OU_FONCTION_INADAPTE');
    if(template.excludedTags?.some(t=>location.tags?.includes(t))) reasons.push('LIEU_EXCLU');
    if(template.zone&&template.zone!==location.zone) reasons.push('ZONE_INADAPTEE');
    if(location.tags?.includes('surface')&&!template.locationTags?.includes('surface')) reasons.push('EXTERIEUR_SURFACE_NON_PREVU');
  }
  return {allowed:reasons.length===0,reasons,exceptionApproved:approvedNamed};
}
function hashInt(s){let h=2166136261;for(const ch of String(s)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0;}
function seededRng(seed='LoreSmith'){let a=hashInt(seed);return ()=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};}
function diceRoll(expr, rng=Math.random){let s=String(expr||'1');let m=s.match(/^(\d+)d(\d+)([+-]\d+)?$/i);if(!m){let k=Number(s);if(!Number.isSafeInteger(k)||k<0)throw Error(`Invalid dice: ${s}`);return k;}let n=+m[1],faces=+m[2],bonus=+(m[3]||0);if(n>100||faces>10000||n<1||faces<1)throw Error(`Invalid dice bounds: ${s}`);let sum=bonus;for(let i=0;i<n;i++)sum+=1+Math.floor(rng()*faces);return Math.max(0,sum);}
const weights={common:10,uncommon:4,rare:1,exceptional:0.05};
function candidateEncounters(location, templates=TEMPLATES,options={}) {
  return templates.map(t=>({template:t,validation:validateComposition(t,location,options)}))
    .filter(x=>x.validation.allowed).map(x=>{
      let weight=weights[x.template.rarity]??1;
      // A place's inhabitants dominate its routine encounters; foreigners are not interchangeable.
      // This is a game distribution proposal, not a historical claim about the fictional city.
      if(location.owner){
        if(x.template.faction===location.owner)weight*=4;
        else if(x.template.faction==='fauna')weight*=0.65;
        else if(x.template.faction==='independent')weight*=0.4;
        else weight*=0.06;
      }
      const overlap=(x.template.locationTags||[]).filter(t=>location.tags?.includes(t)).length;
      if(overlap>1)weight*=1.2;
      if(location.traffic==='low'&&['caravan','trade','travelers'].includes(x.template.kind))weight*=0.4;
      if(location.traffic==='high'&&['caravan','trade','travelers'].includes(x.template.kind))weight*=1.8;
      if(location.currentWar==='active'&&['patrol','military'].includes(x.template.kind))weight*=1.5;
      return {...x,weight};
    }).filter(x=>x.weight>0);
}
function generateEncounter(location, templates=TEMPLATES, opts={}) {
  if(!location?.id)throw Error('A location with id is required');
  const rng=seededRng(opts.seed??`${location.id}:1`),pool=candidateEncounters(location,templates,opts);
  if(!pool.length)return {status:'no_eligible_encounter',locationId:location.id,reason:'Aucun modèle satisfait les règles pour ce lieu.',eligible:0};
  const total=pool.reduce((s,x)=>s+x.weight,0);let n=rng()*total;const selected=pool.find(x=>(n-=x.weight)<=0)||pool.at(-1);
  const refs=new Map((opts.creatures||CREATURE_REFS).map(x=>[x.id,x]));
  const footprintFromSize={Tiny:{width:0.5,height:0.5},Small:{width:1,height:1},Medium:{width:1,height:1},Large:{width:2,height:2},Huge:{width:3,height:3},Gargantuan:{width:4,height:4}};
  const archetypes=new Map((opts.archetypes||NPC_ARCHETYPES).map(x=>[x.id,x]));
  const members=(selected.template.groupMembers||[]).map(x=>{
    const ref=refs.get(x.creatureId)||null; const role=archetypes.get(x.archetypeId)||null;
    const size=ref?.size??role?.size??null;
    const gridFootprint=ref?.gridFootprint??ref?.footprint??role?.gridFootprint??footprintFromSize[size]??null;
    return {...x,count:diceRoll(x.countDice,rng),creatureName:ref?.name||role?.name||null,
      size,gridFootprint,potentialLoot:ref?.loot??role?.typicalCarriedItems??[],
      lootSource:ref?'bestiary_creature':role?'profession_role':'unresolved',
      automaticLootAward:false,unresolvedStatblock:!ref};
  });
  return {status:'generated',schema:'loresmith-scene-encounter-v1',locationId:location.id,
    locationName:location.name,seed:opts.seed??`${location.id}:1`,templateId:selected.template.id,
    title:selected.template.name,kind:selected.template.kind,initialStance:selected.template.initialStance,
    groupMembers:members,goals:selected.template.primaryGoal,hook:selected.template.hook,branches:selected.template.branches,
    cargo:selected.template.cargo,aftermath:selected.template.aftermath,
    enforceNoAutoLoot:true,sourceStatus:selected.template.status,locationStatus:location.eligibilityStatus,
    warnings:[...(location.scenarioOnly?['LIEU_EN_DEVELOPPEMENT_SANS_CANON']:[]),
      ...(members.some(x=>x.unresolvedStatblock)?['CERTAINS_ARCHETYPES_PNJ_SANS_BLOC_DE_STATS']:[]),
      ...(selected.template.exceptionId?['RENCONTRE_EXCEPTIONNELLE_NOMMEE']:[])]};
}

function validateAllTemplates(templates=TEMPLATES,options={}) {
  const ids=new Set();const errors=[];const refs=new Set(CREATURE_REFS.map(x=>x.id));
  const roles=new Set(NPC_ARCHETYPES.map(x=>x.id));
  for(const t of templates){if(ids.has(t.id))errors.push(`${t.id}: id dupliqué`);ids.add(t.id);
    if(!t.name||!t.kind||!Array.isArray(t.locationTags))errors.push(`${t.id}: champs requis absents`);
    for(const p of t.groupMembers||[]){if(p.creatureId&&!refs.has(p.creatureId))errors.push(`${t.id}: ref inconnue ${p.creatureId}`);
      if(p.archetypeId&&!roles.has(p.archetypeId))errors.push(`${t.id}: role inconnu ${p.archetypeId}`);}
    if(t.faction==='moriquendi'&&t.groupMembers.some(x=>x.species!=='moriquendi')&& t.groupCategory!=='named_exception') errors.push(`${t.id}: groupe moriquendi mixte sans exception`);
    if((t.groupMembers||[]).some(x=>x.species==='moriquendi')&&t.faction!=='moriquendi')errors.push(`${t.id}: Moriquendi avec autorite exterieure`);
    const namedSpecies=unique((t.groupMembers||[]).map(x=>x.species).filter(x=>x!=='fauna'));
    if(!namedSpecies.includes('moriquendi')&&namedSpecies.length>1&&!t.associationJustification?.description) errors.push(`${t.id}: association interpeuples sans motif explicite`);
  }
  return {ok:!errors.length,templates:templates.length,errors};
}

return { classifyFeature, classifyCanonPlace, classifyPublishedCity, buildInventory,
  validateComposition, candidateEncounters, generateEncounter, validateAllTemplates,
  seededRng, diceRoll, TEMPLATES, CREATURE_REFS };
}
