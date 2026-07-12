// Word Validation Service dictionary (Scrabble Module §6.1). A configurable
// word list validates every placement server-side. This is a curated STARTER
// list — every standard 2-letter word plus a few hundred common 3–8 letter
// words — enough for real play, the bot, puzzles and tests. For production it
// should be swapped for a full tournament list (TWL/SOWPODS) loaded from a data
// file; `isValidWord` is the single seam that change goes through.

// All 2-letter words valid in tournament Scrabble (TWL-style). Short words are
// the backbone of the game, so this set is complete rather than curated.
const TWO_LETTER = [
  "aa","ab","ad","ae","ag","ah","ai","al","am","an","ar","as","at","aw","ax","ay",
  "ba","be","bi","bo","by","da","de","do","ed","ef","eh","el","em","en","er","es","et","ex",
  "fa","fe","gi","go","ha","he","hi","hm","ho","id","if","in","is","it","jo","ka","ki",
  "la","li","lo","ma","me","mi","mm","mo","mu","my","na","ne","no","nu","od","oe","of","oh",
  "oi","om","on","op","or","os","ow","ox","oy","pa","pe","pi","po","qi","re","sh","si","so",
  "ta","te","ti","to","uh","um","un","up","us","ut","we","wo","xi","xu","ya","ye","yo","za",
];

// Common 3–8 letter words. Deliberately broad and everyday so the bot finds
// plays and students recognise the words. Extend freely.
const COMMON = `
cat cot cut cog dog dot dip did die dye ear eat eft egg elf elk end era ergo
ace act add age ago aid ail aim air ale all and ant any ape apt arc are ark arm art ash ask
bad bag ban bar bat bay bed bee beg bet bid big bin bit boa bob bog boo bow box boy bra bud bug bun bus but buy
day den dew dim din dob doe don dry dub dud dug dun duo ear eel elm emu eon eve ewe eye
fad fan far fat fax fed fee few fib fig fin fir fit fix fizz flu fly foe fog fox fry fun fur
gab gag gal gap gas gel gem get gig gin god got gum gun gut guy gym had hag ham has hat hay hem hen her hew hey hid him hip his hit hob hoe hog hop hot how hub hue hug hum hut
ice icky ill imp ink inn ion irk ivy jab jam jar jaw jay jet jig job jog jot joy jug jut keg key kid kin kit
lab lad lag lap law lax lay led leg let lid lie lip lit lob log lop lot low lug
mad man map mar mat maw may men met mew mid mix mob mod mom mop mud mug mum
nab nag nap nay net new nib nil nip nit nod nor not now nub nun nut oaf oak oar oat odd ode off oft oil old one orb ore our out owe owl own
pad pal pan pap par pat paw pay pea peg pen pep per pet pew pie pig pin pit pod pop pot pox pro pry pub pug pun pup pus put
rad rag ram ran rap rat raw ray red rib rid rig rim rip rob rod roe rot row rub rue rug rum run rut
sad sag sap sat saw say sea see set sew she shy sin sip sir sit six ski sky sly sob sod son sop sow soy spa spy sty sub sue sum sun sup
tab tad tag tan tap tar tat tax tea ten the thy tic tie tin tip toe ton too top tot tow toy try tub tug tux two
urn use van vat vet vex via vie vim vow wad wag war was wax way web wed wee wet who why wig win wit woe wok won woo wow wry
yak yam yap yaw yea yen yes yet yew yip you yum zap zip zit zoo
able acid aged also area army away baby back ball band bank base bath bear beat been beer bell belt bend best bike bind bird bite blue boat body bold bone book boot born both bowl bulk burn bush busy cake call calm came camp card care cart case cash cast cave cell cent chat chef chin chip city clay clip club coal coat code coin cold come cook cool cope copy cord core corn cost crew crop cube cull curl cute damp dark dart data date dawn dead deaf deal dear debt deck deep deer desk dial dice diet dine dirt dish dock does done doom door dose dove down drag draw drew drip drop drug drum dual duck dude duke dull dust duty each earn ease east easy edge edit else even ever evil exam exit face fact fade fail fair fall fame farm fast fate fear feat feed feel feet fell felt file fill film find fine fire firm fish fist five flag flat flaw flea fled flee flew flex flip flow foam fold folk fond food fool foot ford fork form fort four free frog from fuel full fund fury fuse gain game gang gate gave gaze gear gene germ gift girl give glad glow glue goal goat goes gold golf gone good gown grab gray grew grid grim grin grip grow gulf gull guru gush gust
hair half hall halt hand hang hard harm hate have hawk haze head heal heap hear heat heel held hell helm help herb herd hero hide high hill hind hint hire hive hold hole holy home hood hoof hook hope horn hose host hour huge hull hung hunt hurt hush hymn icon idea idle inch iron item jail jazz jeep jerk jest jinx jive join joke jolt joke jump junk jury just keen keep kept kick kill kind king kiss kite knee knew knit knob knot know lace lack lady laid lake lamb lame lamp land lane lark last late lawn lazy lead leaf leak lean leap left lend lens less lest liar lice lick life lift like lily limb lime limp line link lion list live load loaf loan lock loft logo lone long look loom loop lord lose loss lost loud love luck lump lung lure lurk lush lust
made mail main make male mall malt many mark mars mash mask mass mast mate math meal mean meat meet melt memo mend mere mesh mess mice mild mile milk mill mind mine mint miss mist mode mold mole monk mood moon moor moss most moth move much muck mule mush must mute myth
nail name nape navy near neat neck need nest news next nice nick nine node none noon norm nose note noun nova nude numb oath obey odds oily omen once only onto onyx open oral oust oven over pace pack page paid pain pair pale palm pane park part pass past path pave pawn peak pear peel peer perk pest pick pier pile pill pine pink pint pipe plan play plea plot plow plug plum plus poem poet poke pole poll pond pool poor pope pork port pose posh post pour pray prep prey prod prom prop pull pulp pump punk pure push
quad quay quiz race rack raft rage raid rail rain rake ramp rang rank rant rare rash rate rave read real reap rear reed reef reel rely rent rest rice rich ride rife rift ring riot ripe rise risk road roam roar robe rock rode role roll roof room root rope rose ruby rude ruin rule rung rush rust
sack safe saga sage said sail sake sale salt same sand sang sank save scan scar seal seam seat sect seed seek seem seen self sell send sent sept ship shoe shop shot show shut sick side sift sigh sign silk sill silo sing sink site size skid skin skip slab slam slap sled slid slim slip slit slot slow slug snap snow soak soap soar sock soda sofa soft soil sold sole solo some song soon sore sort soul soup sour span spare spin spit spot spun spur stab star stay stem step stew stir stop stub stud stun such suck suit sung sunk sure surf swap sway swim swum
tail take tale talk tall tame tank tape task taxi teak team tear teen tell tend tent term test text than that thaw thee them then they thin this thud thug thus tick tide tidy tied tier tile till tilt time tiny tire toad toe told toll tomb tone tool toot tore torn tort toss tour town trap tray tree trek trim trip trod trot true tsar tuba tube tuck tuft tuna tune turf turn twig twin twit tyke type tyre
undo unit upon urge used user vain vale vane vary vase vast veal veer veil vein vend vent verb very vest veto vial vice view vine visa void volt vote wade wage wail wait wake walk wall wand want ward ware warm warn warp wart wary wash wasp watt wave wavy waxy weak wear weed week weep well went were west what when whim whip whir whiz whom wick wide wife wild will wilt wind wine wing wink wipe wire wise wish with woke wolf wood wool word wore work worm worn wrap wren yard yarn yawn yeah year yell yoga yolk your zeal zero zest zinc zone zoom
about above actor added admit adopt adult after again agent agree ahead alarm album alert alien align alike alive allow alone along aloud alpha altar alter amber amend among ample angel anger angle angry ankle apart apple apply april arena argue arise armor aroma array arrow aside asset audio audit avoid awake award aware awful bacon badge baker basic basil batch beach beard beast began begin being belly below bench berry bible bicep birch birth black blade blame blank blast blaze bleak bleed blend bless blind blink block bloom blown blues bluff blunt blurt board boast bonus boost booth boron bound bowel boxer brace brain brake brand brass brave bread break breed brick bride brief bring brink brisk broad broke brook broom brown brush build built bulge bunch burst
cabin cable cache cadet cameo canal candy canon caper cargo carol carry carve catch cater cause cease cedar chain chair chalk champ chant chaos charm chart chase cheap cheat check cheek cheer chess chest chick chief child chili chill china chirp chock choir chord chore chose chuck chunk cider cigar civic civil claim clamp clang clash clasp class clean clear clerk click cliff climb cling clink cloak clock clone close cloth cloud clout clown coach coast cobra cocoa colon color comet comic coral corps couch cough could count court cover covet crack craft cramp crane crank crash crate crave crawl craze crazy cream creek creep crept crest crime crimp crisp croak crook cross crowd crown crude cruel crumb crush crust crypt cubic curse curve cycle
daddy daily dairy daisy dance dandy dared dealt death debit debut decal decay decor decoy defer deity delay delta demon dense depot depth derby deter devil diary dicey digit dimly diner dingo dingy diode dirty ditch ditto ditty diver dizzy dodge doing donor donut doubt dough dowel dozen draft drain drama drank drape drawl drawn dread dream dress dried drift drill drink drive droll drone drool droop drove drown druid drunk dryer dryly dully dummy dumpy dunce dusky dusty dutch dwarf dwell dying
eager eagle early earth easel eaten eater ebony edict edify eerie egret eight elbow elder elect elegy elfin elide elite elope elude elves email ember emcee empty enact enemy enjoy ennui ensue enter entry envoy epoch epoxy equal equip erase erect erode error erupt essay ester ethic ethos evade event every evict evoke exact exalt excel exert exile exist expel extol extra exult
fable faced facet fairy faith false famed fancy fanny farce fatal fault favor feast fecal feign fella felon femur fence feral ferry fetal fetch fever fewer fiber field fiend fiery fifth fifty fight filet filly filmy filth final finch finer first fishy fixed fizzy fjord flack flail flair flake flame flank flare flash flask fleck flesh flick flier fling flint flirt float flock flood floor flora floss flour flout flown fluff fluid fluke flung flush flute flyer foamy focal focus foggy foist folio folly foray force forge forgo forte forth forty forum found fount foyer frail frame frank fraud freak freed fresh fried frill frisk fritz frizz frock frond front frost froth frown froze fruit fudge fully fumes funny furry fussy fuzzy
gaily gamer gamma gauge gaunt gauze gavel gawky gayer gazer gecko geese genie genre ghost ghoul giant giddy given giver gizmo glade gland glare glass glaze gleam glean glide glint gloat globe gloom glory gloss glove glyph gnash gnome godly going golem gonad goner gooey goofy goose gorge gouge gourd grace grade graft grain grand grant grape graph grasp grass grate grave gravy graze great greed green greet grief grill grime grimy grind gripe groan groin groom grope gross group grout grove growl grown gruel gruff grunt guard guava guess guest guide guild guile guilt guise gulch gully gumbo gully guppy gusto gusty gypsy
`;

// One-time built set of every valid word, lowercased. Small enough to hold in
// memory; a production build would stream a large list instead.
const WORDS: Set<string> = (() => {
  const s = new Set<string>();
  for (const w of TWO_LETTER) s.add(w);
  for (const w of COMMON.split(/\s+/)) {
    const t = w.trim().toLowerCase();
    if (t.length >= 3) s.add(t);
  }
  return s;
})();

export function isValidWord(word: string): boolean {
  return WORDS.has(word.trim().toLowerCase());
}

// The full validated set — the bot reads this to find candidate plays.
export function dictionaryWords(): Set<string> {
  return WORDS;
}
