(() => {
  "use strict";
  const STORAGE_KEY = "gymquest.web.v1";
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const todayKey = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  };
  const dayBefore = key => { const d = new Date(`${key}T12:00:00`); d.setDate(d.getDate()-1); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };
  const uid = () => (crypto?.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const builtIns = [
    ["Barbell Bench Press","Chest","Barbell",4,"6–8"],["Incline Dumbbell Press","Chest","Dumbbells",3,"8–12"],["Chest Press Machine","Chest","Machine",3,"8–12"],["Cable Fly","Chest","Cable",3,"12–15"],["Push-Ups","Chest","Bodyweight",3,"AMRAP"],
    ["Lat Pulldown","Back","Cable machine",3,"8–12"],["Seated Cable Row","Back","Cable machine",3,"8–12"],["Chest-Supported Row","Back","Machine or bench",3,"8–12"],["Assisted Pull-Up","Back","Pull-up machine",3,"6–10"],["Face Pull","Back","Cable",3,"12–15"],
    ["Overhead Press","Shoulders","Barbell or dumbbells",3,"6–10"],["Dumbbell Lateral Raise","Shoulders","Dumbbells",3,"12–15"],["Reverse Pec Deck","Shoulders","Machine",3,"12–15"],["Rear Delt Fly","Shoulders","Dumbbells or machine",3,"12–15"],
    ["Squat","Legs","Barbell or bodyweight",4,"6–10"],["Leg Press","Legs","Machine",3,"10–12"],["Romanian Deadlift","Legs","Barbell or dumbbells",3,"8–10"],["Leg Curl","Legs","Machine",3,"10–15"],["Leg Extension","Legs","Machine",3,"10–15"],["Standing Calf Raise","Legs","Machine",3,"12–20"],
    ["Dumbbell Bicep Curl","Arms","Dumbbells",3,"10–12"],["Hammer Curl","Arms","Dumbbells",3,"10–12"],["Cable Triceps Pushdown","Arms","Cable",3,"10–15"],["Overhead Triceps Extension","Arms","Cable or dumbbell",3,"10–15"],
    ["Plank","Core","Bodyweight",3,"30–60 sec"],["Dead Bug","Core","Bodyweight",3,"10 each side"],["Cable Crunch","Core","Cable",3,"12–15"],["Hanging Knee Raise","Core","Pull-up bar",3,"8–12"],
    ["Treadmill Walk","Cardio","Treadmill",1,"10 min"],["Stationary Bike","Cardio","Bike",1,"10 min"],["Rowing Machine","Cardio","Rower",1,"5–10 min"],
    ["Goblet Squat","Full Body","Dumbbell or kettlebell",3,"10–12"],["Farmer's Carry","Full Body","Dumbbells",3,"30–45 sec"],["Burpees","Full Body","Bodyweight",3,"8–12"]
  ].map(([name,muscle,equipment,sets,reps]) => ({id:`builtin-${name.toLowerCase().replace(/[^a-z0-9]+/g,"-")}`,name,muscle,equipment,sets,reps,builtin:true}));
  const ACHIEVEMENTS = [
    {id:"first-workout",icon:"🎯",name:"First Quest",description:"Complete your first workout.",test:s=>s.history.length>=1,xp:25},
    {id:"five-workouts",icon:"🖐️",name:"Getting Consistent",description:"Complete 5 workouts.",test:s=>s.history.length>=5,xp:50},
    {id:"ten-workouts",icon:"🏅",name:"Dedicated",description:"Complete 10 workouts.",test:s=>s.history.length>=10,xp:75},
    {id:"twenty-five",icon:"🏆",name:"Iron Habit",description:"Complete 25 workouts.",test:s=>s.history.length>=25,xp:150},
    {id:"first-streak",icon:"🔥",name:"On a Roll",description:"Build a 3-day workout streak.",test:s=>s.bestStreak>=3,xp:50},
    {id:"week-streak",icon:"⚡",name:"Unstoppable",description:"Build a 7-day workout streak.",test:s=>s.bestStreak>=7,xp:150},
    {id:"library-five",icon:"📚",name:"Exercise Collector",description:"Add 5 custom exercises.",test:s=>s.exercises.filter(e=>!e.builtin).length>=5,xp:30},
    {id:"workout-builder",icon:"🧩",name:"Quest Creator",description:"Create your first workout routine.",test:s=>s.workouts.length>=1,xp:20},
    {id:"level-five",icon:"🌟",name:"Rising Hero",description:"Reach level 5.",test:s=>levelInfo(s.xp).level>=5,xp:100}
  ];
  function freshState() {
    return {version:2,xp:0,exercises:[...builtIns],workouts:[],history:[],earned:[],lastWorkoutDate:null,currentStreak:0,bestStreak:0,customIds:[],session:null,weightEntries:[],rides:[]};
  }
  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return freshState();
      const parsed = JSON.parse(raw);
      const defaults = freshState();
      const exercises = Array.isArray(parsed.exercises) ? parsed.exercises : defaults.exercises;
      const custom = exercises.filter(e=>!e.builtin);
      const byId = new Map([...defaults.exercises,...custom].map(e=>[e.id,e]));
      return {...defaults,...parsed,exercises:[...defaults.exercises,...custom],workouts:Array.isArray(parsed.workouts)?parsed.workouts:[],history:Array.isArray(parsed.history)?parsed.history:[],earned:Array.isArray(parsed.earned)?parsed.earned:[],weightEntries:Array.isArray(parsed.weightEntries)?parsed.weightEntries:[],rides:Array.isArray(parsed.rides)?parsed.rides:[],customIds:parsed.customIds||custom.map(e=>e.id)};
    } catch { return freshState(); }
  }
  let state = loadState();
  let editingWorkoutId = null;
  let activeSession = null;
  let earnedThisSession = 0;
  let toastTimer;
  let rideMap=null, rideLine=null, rideMarker=null, rideWatchId=null, rideStartedAt=null, rideTimer=null, liveRide=null;
  function save() { try { localStorage.setItem(STORAGE_KEY,JSON.stringify(state)); } catch { toast("Couldn't save locally. Check your browser storage."); } }
  function esc(value) { return String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
  function levelInfo(xp) {
    let level=1, remaining=Math.max(0,xp), need=250;
    while (remaining>=need && level<1000) { remaining-=need; level++; need=Math.round(250+(level-1)*100); }
    const nextNeed=Math.round(250+(level-1)*100);
    return {level,within:remaining,need:nextNeed,rank:level<3?"Gym Recruit":level<5?"Rookie Lifter":level<8?"Iron Apprentice":level<12?"Strength Seeker":level<20?"Elite Athlete":"Legendary Warrior"};
  }
  function calcStreak(history) {
    const days=[...new Set(history.map(h=>h.date))].sort().reverse();
    if (!days.length) return {current:0,best:0};
    const today=todayKey(), yesterday=dayBefore(today);
    let current=0;
    if(days[0]===today||days[0]===yesterday) {
      let expected=days[0];
      for(const d of days){if(d!==expected)break;current++;expected=dayBefore(expected);}
    }
    let best=0,run=0,prev=null;
    for(const d of [...days].reverse()){if(prev&&d===nextDay(prev))run++;else run=1;best=Math.max(best,run);prev=d;}
    return {current,best:Math.max(best,current)};
  }
  function nextDay(key){const d=new Date(`${key}T12:00:00`);d.setDate(d.getDate()+1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;}
  function toast(message){const node=$("#toast");node.textContent=message;node.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>node.classList.remove("show"),2300);}
  function getExercise(id){return state.exercises.find(e=>e.id===id);}
  function checkAchievements() {
    const newly=[];
    for(const a of ACHIEVEMENTS){if(!state.earned.includes(a.id)&&a.test(state)){state.earned.push(a.id);state.xp+=a.xp;newly.push(a);}}
    return newly;
  }
  function setPage(page) {
    $$(".page").forEach(p=>p.classList.toggle("active",p.id===`page-${page}`));
    $$(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.page===page));
    $("#bottomNav").style.display=page==="session"?"none":"grid";
    window.scrollTo({top:0,behavior:"smooth"});
  }
  function workoutCard(w) {
    const exercises=w.exerciseIds.map(getExercise).filter(Boolean);
    return `<article class="workout-card"><div class="workout-symbol">🏋️</div><div class="workout-card-main"><h3>${esc(w.name)}</h3><p>${exercises.length} exercises · ${exercises.reduce((sum,e)=>sum+e.sets,0)} total sets</p></div><div class="card-actions"><button class="small-button start" data-start="${esc(w.id)}">Start ▶</button><button class="small-button" data-edit="${esc(w.id)}">Edit</button><button class="small-button" data-delete="${esc(w.id)}" aria-label="Delete ${esc(w.name)}">✕</button></div></article>`;
  }
  function empty(title,description){return `<div class="empty-state"><strong>${esc(title)}</strong>${esc(description)}</div>`;}
  function renderDashboard(){
    const info=levelInfo(state.xp);
    $("#levelNumber").textContent=info.level;$("#rankName").textContent=info.rank;$("#totalXp").textContent=state.xp.toLocaleString();
    $("#xpText").textContent=`${info.within} / ${info.need} XP to next level`;$("#xpBar").style.width=`${Math.min(100,info.within/info.need*100)}%`;
    const streak=calcStreak(state.history);state.currentStreak=streak.current;state.bestStreak=Math.max(state.bestStreak||0,streak.best);
    $("#streakValue").textContent=streak.current;$("#workoutCount").textContent=state.history.length;$("#achievementCount").textContent=state.earned.length;
    $("#dashboardWorkouts").innerHTML=state.workouts.length?state.workouts.slice(0,3).map(workoutCard).join(""):empty("Your first quest starts here","Create a workout from your exercise library to begin.");
    $("#dashboardAchievements").innerHTML=ACHIEVEMENTS.filter(a=>state.earned.includes(a.id)).slice(-5).map(a=>`<div class="achievement-chip"><div class="badge-icon">${a.icon}</div><strong>${esc(a.name)}</strong><span>+${a.xp} XP earned</span></div>`).join("")||empty("No achievements yet","Complete workouts to unlock your first badge.");
  }
  function renderWorkouts(){ $("#workoutList").innerHTML=state.workouts.length?state.workouts.map(workoutCard).join(""):empty("No workouts yet","Create your first routine and pick the exercises you want to do."); }
  function renderLibrary(){
    const q=$("#exerciseSearch").value.trim().toLowerCase(), muscle=$("#muscleFilter").value;
    const list=state.exercises.filter(e=>(muscle==="All"||e.muscle===muscle)&&`${e.name} ${e.muscle} ${e.equipment}`.toLowerCase().includes(q));
    $("#libraryCount").textContent=`${list.length} exercise${list.length===1?"":"s"} · ${state.exercises.filter(e=>!e.builtin).length} custom`;
    $("#exerciseList").innerHTML=list.map(e=>`<div class="exercise-row"><div class="exercise-emoji">${muscleIcon(e.muscle)}</div><div class="exercise-info"><strong>${esc(e.name)}</strong><span>${esc(e.muscle)} · ${esc(e.equipment||"Equipment not set")} · ${e.sets} × ${esc(e.reps)}</span></div>${e.builtin?`<span class="muted tiny">BUILT-IN</span>`:`<button class="small-button" data-remove-exercise="${esc(e.id)}">Remove</button>`}</div>`).join("")||empty("No matches","Try another search or muscle group.");
  }
  function muscleIcon(m){return ({Chest:"💥",Back:"🪽",Shoulders:"🛡️",Legs:"🦵",Arms:"💪",Core:"🎯",Cardio:"🏃","Full Body":"⚡"})[m]||"🏋️";}
  function renderProgress(){
    const streak=calcStreak(state.history);
    $("#progressXp").textContent=state.xp.toLocaleString();$("#progressStreak").textContent=`${streak.current} days`;$("#progressWorkouts").textContent=state.history.length;
    $("#allAchievements").innerHTML=ACHIEVEMENTS.map(a=>{const earned=state.earned.includes(a.id);return `<div class="achievement-row ${earned?"":"locked"}"><div class="badge-icon">${a.icon}</div><div><strong>${esc(a.name)}</strong><p>${esc(a.description)}</p></div><span class="earned-label">${earned?"UNLOCKED":`+${a.xp} XP`}</span></div>`;}).join("");
    $("#historyList").innerHTML=state.history.length?[...state.history].reverse().slice(0,30).map(h=>`<div class="history-item"><div><strong>${esc(h.name)}</strong><span>${esc(h.date)} · ${h.exerciseCount} exercises · ${Math.max(1,Math.round((h.duration||0)/60))} min</span></div><span class="history-xp">+${h.xp} XP</span></div>`).join(""):empty("No history yet","Your completed workouts will appear here.");
  }
  function formatWeight(value){return `${Number(value).toLocaleString(undefined,{maximumFractionDigits:1})} kg`;}
  function renderTrackers(){
    const entries=[...(state.weightEntries||[])].sort((a,b)=>a.date.localeCompare(b.date)||a.createdAt-b.createdAt);
    const latest=entries[entries.length-1], previous=entries.length>1?entries[entries.length-2]:null;
    $("#currentWeight").textContent=latest?formatWeight(latest.weight):"—";
    if(latest&&previous){const delta=latest.weight-previous.weight;const sign=delta>0?"+":"";$("#weightChange").textContent=`${formatWeight(previous.weight)} → ${formatWeight(latest.weight)} · ${sign}${delta.toLocaleString(undefined,{maximumFractionDigits:1})} kg`;$("#weightChange").className=`weight-change ${delta<0?"down":delta>0?"up":"flat"}`;}
    else {$("#weightChange").textContent=latest?"First measurement saved":"Add your first measurement";$("#weightChange").className="weight-change";}
    $("#weightHistoryCount").textContent=`${entries.length} ${entries.length===1?"entry":"entries"}`;
    const chart=$("#weightChart");
    if(entries.length<2){chart.innerHTML=empty(entries.length?"One measurement saved":"No measurements yet",entries.length?"Add another weight later to see your trend.":"Add your weight above to start your progress record.");}
    else {
      const width=320,height=128,pad=18,values=entries.map(e=>e.weight),min=Math.min(...values),max=Math.max(...values),range=max-min||1;
      const pts=entries.map((e,i)=>({x:pad+i*(width-pad*2)/(entries.length-1),y:height-pad-((e.weight-min)/range)*(height-pad*2)}));
      const path=pts.map((pt,i)=>`${i?"L":"M"}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join(" ");
      chart.innerHTML=`<div class="chart-top-labels"><strong>${formatWeight(max)}</strong><span>${formatWeight(min)}</span></div><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Weight trend from ${esc(entries[0].date)} to ${esc(entries[entries.length-1].date)}"><path d="${path}" fill="none" stroke="#b7f36b" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>${pts.map(pt=>`<circle cx="${pt.x}" cy="${pt.y}" r="4" fill="#b7f36b" stroke="#10130f" stroke-width="2"/>`).join("")}</svg><div class="chart-dates"><span>${esc(entries[0].date)}</span><span>${esc(entries[entries.length-1].date)}</span></div>`;
    }
    $("#weightHistory").innerHTML=entries.length?[...entries].reverse().map((e,i,arr)=>{const older=arr[i+1];const d=older?e.weight-older.weight:null;return `<article class="tracker-history-row"><div><strong>${formatWeight(e.weight)}</strong><span>${esc(e.date)}</span></div><div class="history-delta ${d===null?"":d<0?"down":d>0?"up":"flat"}">${d===null?"First entry":`${d>0?"+":""}${d.toLocaleString(undefined,{maximumFractionDigits:1})} kg`}</div><button class="small-button" data-delete-weight="${esc(e.id)}" aria-label="Delete weight entry">✕</button></article>`;}).join(""):"";
    const rides=[...(state.rides||[])].sort((a,b)=>(b.completedAt||0)-(a.completedAt||0));
    $("#rideHistoryCount").textContent=`${rides.length} ${rides.length===1?"ride":"rides"}`;
    $("#rideHistory").innerHTML=rides.length?rides.map(r=>`<article class="ride-history-card"><div class="ride-history-top"><span class="ride-badge">🚴</span><div class="ride-history-main"><strong>${esc(r.name||"Bike ride")}</strong><span>${esc(r.date)}${r.duration?` · ${Math.round(r.duration/60)} min`:""}</span></div><strong class="ride-km">${Number(r.distance).toFixed(2)} km</strong></div>${r.notes?`<p>${esc(r.notes)}</p>`:""}${r.points?.length>1?`<button class="small-button" data-show-ride="${esc(r.id)}">Show route on map</button>`:""}<button class="small-button danger-inline" data-delete-ride="${esc(r.id)}">Delete</button></article>`).join(""):empty("No rides recorded yet","Record a GPS ride or add a past ride below.");
  }
  function initRideMap(){
    if(rideMap||!window.L)return;
    rideMap=L.map("rideMap",{zoomControl:true}).setView([38.7223,-9.1393],7);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}).addTo(rideMap);
    rideLine=L.polyline([],{color:"#b7f36b",weight:5,opacity:.9}).addTo(rideMap);
    $("#rideMapNote").textContent="Ready. Start a GPS ride to draw your route, or open a saved route from ride history.";
    setTimeout(()=>rideMap.invalidateSize(),200);
  }
  function distanceKm(a,b){const rad=x=>x*Math.PI/180;const dLat=rad(b.lat-a.lat),dLon=rad(b.lng-a.lng),lat1=rad(a.lat),lat2=rad(b.lat);const h=Math.sin(dLat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2;return 6371*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));}
  function updateRideStats(){if(!liveRide)return;$("#rideDistance").textContent=`${liveRide.distance.toFixed(2)} km`;$ ("#ridePoints").textContent=liveRide.points.length;const sec=Math.floor((Date.now()-rideStartedAt)/1000);$("#rideDuration").textContent=`${String(Math.floor(sec/60)).padStart(2,"0")}:${String(sec%60).padStart(2,"0")}`;}
  function startRide(){
    if(!navigator.geolocation){toast("GPS location is not supported by this browser.");return;}
    if(!window.L){toast("Map library is still loading. Check your internet and try again.");return;}
    if(rideWatchId!==null)return;
    initRideMap();liveRide={id:uid(),name:"GPS bicycle ride",date:todayKey(),startedAt:Date.now(),distance:0,points:[],notes:""};rideStartedAt=Date.now();rideLine.setLatLngs([]);$("#startRide").disabled=true;$("#stopRide").disabled=false;$("#rideMapNote").textContent="Waiting for GPS signal… keep location enabled.";
    rideWatchId=navigator.geolocation.watchPosition(pos=>{
      const point={lat:pos.coords.latitude,lng:pos.coords.longitude,at:pos.timestamp||Date.now(),accuracy:pos.coords.accuracy||0};
      if(point.accuracy>80){$("#rideMapNote").textContent=`GPS accuracy is about ${Math.round(point.accuracy)} m; waiting for a better signal.`;return;}
      const last=liveRide.points[liveRide.points.length-1];
      if(last){const delta=distanceKm(last,point);if(delta<0.003||delta>0.5)return;liveRide.distance+=delta;}
      liveRide.points.push(point);const latlngs=liveRide.points.map(p=>[p.lat,p.lng]);rideLine.setLatLngs(latlngs);if(rideMarker)rideMarker.setLatLng([point.lat,point.lng]);else rideMarker=L.circleMarker([point.lat,point.lng],{radius:7,color:"#10130f",weight:2,fillColor:"#b7f36b",fillOpacity:1}).addTo(rideMap);rideMap.setView([point.lat,point.lng],Math.max(rideMap.getZoom(),15));$("#rideMapNote").textContent="GPS recording is active. Keep this page open while you ride.";updateRideStats();
    },err=>{const messages={1:"Location permission denied. Allow location in your browser settings.",2:"GPS position unavailable. Try moving to an open area.",3:"GPS timed out. Keep going; trying to reconnect."};$("#rideMapNote").textContent=messages[err.code]||"GPS error.";if(err.code===1)stopRide(false);},{enableHighAccuracy:true,maximumAge:2000,timeout:15000});
    rideTimer=setInterval(updateRideStats,1000);toast("GPS ride started. Ride safely!");
  }
  function stopRide(saveRide=true){
    if(rideWatchId!==null){navigator.geolocation.clearWatch(rideWatchId);rideWatchId=null;}if(rideTimer){clearInterval(rideTimer);rideTimer=null;}
    $("#startRide").disabled=false;$("#stopRide").disabled=true;
    if(!liveRide)return;
    liveRide.duration=Math.max(0,Math.round((Date.now()-rideStartedAt)/1000));liveRide.completedAt=Date.now();liveRide.date=todayKey();
    if(saveRide&&liveRide.points.length>=2&&liveRide.distance>0){const suggested=prompt("Name this ride:","My bike ride");liveRide.name=(suggested||"My bike ride").trim()||"My bike ride";state.rides.push(liveRide);save();renderTrackers();toast(`Ride saved · ${liveRide.distance.toFixed(2)} km`);}
    else if(saveRide)toast("Not enough GPS points to save a route yet. You can add the distance manually below.");
    $("#rideMapNote").textContent=saveRide?"Ride stopped. Your saved route stays in this browser.":"GPS stopped.";liveRide=null;rideStartedAt=null;updateRideStats();
  }
  function showRide(id){const ride=state.rides.find(r=>r.id===id);if(!ride?.points?.length||!window.L)return;initRideMap();const coords=ride.points.map(p=>[p.lat,p.lng]);rideLine.setLatLngs(coords);rideMap.fitBounds(rideLine.getBounds(),{padding:[20,20]});$("#rideMapNote").textContent=`Showing ${ride.name} · ${ride.distance.toFixed(2)} km`;$("#page-trackers").scrollIntoView({behavior:"smooth",block:"start"});setTimeout(()=>rideMap.invalidateSize(),200);}

  function renderAll(){renderDashboard();renderWorkouts();renderLibrary();renderProgress();renderTrackers();save();}
  function openWorkoutDialog(id=null){
    editingWorkoutId=id;const workout=id?state.workouts.find(w=>w.id===id):null;
    $("#workoutDialogTitle").textContent=workout?"Edit workout":"Create workout";$("#workoutName").value=workout?.name||"";
    $("#workoutExerciseSearch").value="";renderWorkoutChoices(workout?.exerciseIds||[]);
    $("#workoutDialog").showModal();
  }
  function renderWorkoutChoices(selected=[]){
    const q=$("#workoutExerciseSearch").value.trim().toLowerCase();
    const filtered=state.exercises.filter(e=>`${e.name} ${e.muscle}`.toLowerCase().includes(q));
    $("#workoutExerciseChoices").innerHTML=filtered.map(e=>`<label class="choice-row"><input type="checkbox" name="workoutExercise" value="${esc(e.id)}" ${selected.includes(e.id)?"checked":""}><span>${esc(e.name)}<small>${esc(e.muscle)} · ${e.sets} × ${esc(e.reps)}</small></span></label>`).join("")||empty("No exercises found","Add an exercise to your library first.");
  }
  function saveWorkout(event){
    event.preventDefault();const name=$("#workoutName").value.trim(), ids=$$('input[name="workoutExercise"]:checked').map(i=>i.value).filter(id=>getExercise(id));
    if(!name){toast("Give your workout a name.");return;}if(!ids.length){toast("Choose at least one exercise.");return;}
    if(editingWorkoutId){const w=state.workouts.find(w=>w.id===editingWorkoutId);if(w){w.name=name;w.exerciseIds=ids;}}
    else state.workouts.push({id:uid(),name,exerciseIds:ids,createdAt:Date.now()});
    const newAchievements=checkAchievements();save();$("#workoutDialog").close();renderAll();toast(newAchievements.length?`Achievement unlocked: ${newAchievements[0].name}!`:"Workout saved.");
  }
  function addCustomExercise(event){
    event.preventDefault();const name=$("#customExerciseName").value.trim();if(!name){toast("Enter an exercise name.");return;}
    if(state.exercises.some(e=>e.name.toLowerCase()===name.toLowerCase())){toast("That exercise is already in your library.");return;}
    const sets=Math.max(1,Math.min(10,Number($("#customExerciseSets").value)||3));
    const ex={id:uid(),name,muscle:$("#customExerciseMuscle").value,equipment:$("#customExerciseEquipment").value.trim()||"Not specified",sets,reps:$("#customExerciseReps").value.trim()||"8–12",builtin:false};
    state.exercises.push(ex);state.customIds.push(ex.id);const newly=checkAchievements();save();$("#exerciseDialog").close();$("#exerciseForm").reset();$("#customExerciseSets").value=3;$("#customExerciseReps").value="8–12";renderAll();toast(newly.length?`Achievement unlocked: ${newly[0].name}!`:"Custom exercise added.");
  }
  function startWorkout(id){
    const w=state.workouts.find(w=>w.id===id);if(!w)return;
    const exs=w.exerciseIds.map(getExercise).filter(Boolean);if(!exs.length){toast("Add exercises to this workout first.");return;}
    activeSession={workoutId:w.id,name:w.name,startedAt:Date.now(),items:exs.map(e=>({exerciseId:e.id,done:false,sets:e.sets,reps:e.reps,weight:""}))};earnedThisSession=0;
    $("#sessionName").textContent=w.name;$("#sessionMeta").textContent=`${exs.length} exercises · You've got this.`;renderSession();setPage("session");
  }
  function renderSession(){
    if(!activeSession)return;const done=activeSession.items.filter(i=>i.done).length,total=activeSession.items.length,pct=total?Math.round(done/total*100):0;
    $("#sessionProgressText").textContent=`${done} of ${total} complete`;$("#sessionPercent").textContent=`${pct}%`;$("#sessionProgressBar").style.width=`${pct}%`;
    $("#sessionExercises").innerHTML=activeSession.items.map((item,index)=>{const ex=getExercise(item.exerciseId);if(!ex)return"";return `<article class="session-exercise ${item.done?"completed":""}"><div class="session-exercise-top"><button class="check-button" data-toggle-exercise="${index}" aria-label="${item.done?"Mark incomplete":"Complete"} ${esc(ex.name)}">${item.done?"✓":"✓"}</button><div class="session-exercise-name"><strong>${index+1}. ${esc(ex.name)}</strong><span>${esc(ex.muscle)} · ${esc(ex.equipment||"")}</span></div><span class="muted tiny">${item.done?"DONE":`${index+1}/${total}`}</span></div><div class="session-fields"><label>Sets<input type="number" min="1" max="20" data-field="sets" data-index="${index}" value="${esc(item.sets)}"></label><label>Reps / time<input data-field="reps" data-index="${index}" value="${esc(item.reps)}" maxlength="20"></label><label>Weight<input data-field="weight" data-index="${index}" value="${esc(item.weight)}" placeholder="kg" maxlength="15"></label></div><button class="small-button rest-button" data-rest="${index}">⏱ Rest 90 sec</button></article>`;}).join("");
    $("#finishWorkout").disabled=done===0;
    $("#finishWorkout").textContent=done===total?`Finish workout · +50 XP`:`Finish session · +50 XP`;
  }
  function toggleSessionExercise(index){
    const item=activeSession?.items[index];if(!item)return;
    item.done=!item.done;
    if(item.done){state.xp+=10;earnedThisSession+=10;toast("+10 XP — exercise complete!");}
    else{state.xp=Math.max(0,state.xp-10);earnedThisSession=Math.max(0,earnedThisSession-10);}
    save();renderSession();renderDashboard();
  }
  let restInterval=null;
  function startRest(button){if(restInterval)clearInterval(restInterval);let remaining=90;button.textContent=`⏱ ${remaining}s rest`;restInterval=setInterval(()=>{remaining--;if(!button.isConnected){clearInterval(restInterval);restInterval=null;return;}if(remaining<=0){clearInterval(restInterval);restInterval=null;button.textContent="✓ Rest complete";if(navigator.vibrate)navigator.vibrate(150);}else button.textContent=`⏱ ${remaining}s rest`;},1000);}
  function finishWorkout(){
    if(!activeSession)return;const done=activeSession.items.filter(i=>i.done).length;if(!done){toast("Complete at least one exercise first.");return;}
    const before=state.xp,bonus=50;state.xp+=bonus;
    const duration=Math.max(1,Math.round((Date.now()-activeSession.startedAt)/1000));
    const record={id:uid(),workoutId:activeSession.workoutId,name:activeSession.name,date:todayKey(),completedAt:Date.now(),exerciseCount:done,totalExercises:activeSession.items.length,duration,xp:earnedThisSession+bonus,items:activeSession.items.filter(i=>i.done).map(i=>({exerciseId:i.exerciseId,sets:i.sets,reps:i.reps,weight:i.weight}))};
    state.history.push(record);const streak=calcStreak(state.history);state.currentStreak=streak.current;state.bestStreak=Math.max(state.bestStreak||0,streak.best);
    const newAchievements=checkAchievements();const after=levelInfo(state.xp),prior=levelInfo(before);
    const earned=earnedThisSession+bonus+newAchievements.reduce((sum,a)=>sum+a.xp,0);
    save();activeSession=null;if(restInterval){clearInterval(restInterval);restInterval=null;}
    $("#completeTitle").textContent=after.level>prior.level?`Level ${after.level} unlocked!`:"Workout complete!";
    $("#completeMessage").textContent=newAchievements.length?`Achievement unlocked: ${newAchievements.map(a=>a.name).join(", ")}.`:"You showed up for yourself. Come back when you're ready for your next quest.";
    $("#earnedXp").textContent=`+${earned} XP`;$("#completeDialog").showModal();renderAll();
  }
  function closeSession(){if(!activeSession)return;if(confirm("Exit this workout? Your current session checklist won't be saved.")){activeSession=null;if(restInterval){clearInterval(restInterval);restInterval=null;}setPage("dashboard");}}
  function deleteWorkout(id){const w=state.workouts.find(w=>w.id===id);if(!w)return;if(confirm(`Delete "${w.name}"?`)){state.workouts=state.workouts.filter(w=>w.id!==id);save();renderAll();toast("Workout deleted.");}}
  function removeExercise(id){const ex=getExercise(id);if(!ex||ex.builtin)return;if(state.workouts.some(w=>w.exerciseIds.includes(id))&&!confirm("This exercise is used in one or more workouts. Remove it anyway?"))return;state.exercises=state.exercises.filter(e=>e.id!==id);state.customIds=state.customIds.filter(x=>x!==id);state.workouts.forEach(w=>w.exerciseIds=w.exerciseIds.filter(x=>x!==id));save();renderAll();toast("Exercise removed.");}
  document.addEventListener("click",e=>{
    const page=e.target.closest("[data-page]");if(page){e.preventDefault();setPage(page.dataset.page);}
    const close=e.target.closest("[data-close]");if(close)$("#"+close.dataset.close).close();
    const start=e.target.closest("[data-start]");if(start)startWorkout(start.dataset.start);
    const edit=e.target.closest("[data-edit]");if(edit)openWorkoutDialog(edit.dataset.edit);
    const del=e.target.closest("[data-delete]");if(del)deleteWorkout(del.dataset.delete);
    const rem=e.target.closest("[data-remove-exercise]");if(rem)removeExercise(rem.dataset.removeExercise);
    const toggle=e.target.closest("[data-toggle-exercise]");if(toggle)toggleSessionExercise(Number(toggle.dataset.toggleExercise));
    const rest=e.target.closest("[data-rest]");if(rest)startRest(rest);
  });
  $("#newWorkoutButton").addEventListener("click",()=>openWorkoutDialog());
  $("#addExerciseButton").addEventListener("click",()=>$("#exerciseDialog").showModal());
  $("#workoutForm").addEventListener("submit",saveWorkout);
  $("#exerciseForm").addEventListener("submit",addCustomExercise);
  $("#workoutExerciseSearch").addEventListener("input",()=>{const selected=$$('input[name="workoutExercise"]:checked').map(i=>i.value);renderWorkoutChoices(selected);});
  $("#exerciseSearch").addEventListener("input",renderLibrary);$("#muscleFilter").addEventListener("change",renderLibrary);
  $("#quickStart").addEventListener("click",()=>{if(state.workouts.length)startWorkout(state.workouts[0].id);else openWorkoutDialog();});
  $("#leaveSession").addEventListener("click",closeSession);$("#finishWorkout").addEventListener("click",finishWorkout);
  $("#closeComplete").addEventListener("click",()=>{$("#completeDialog").close();setPage("dashboard");});
  $("#resetProgress").addEventListener("click",()=>{if(confirm("This permanently deletes your workouts, custom exercises, XP, streaks and history from this browser. Continue?")){localStorage.removeItem(STORAGE_KEY);state=freshState();activeSession=null;renderAll();setPage("dashboard");toast("All GymQuest data reset.");}});
  $("#weightDate").value=todayKey();$("#manualRideDate").value=todayKey();
  $("#weightForm").addEventListener("submit",e=>{e.preventDefault();const weight=Number($("#weightInput").value);if(!Number.isFinite(weight)||weight<=0){toast("Enter a valid weight.");return;}const date=$("#weightDate").value||todayKey();const entry={id:uid(),weight:Math.round(weight*10)/10,date,createdAt:Date.now()};state.weightEntries.push(entry);save();renderTrackers();$("#weightInput").value="";toast("Weight measurement saved.");});
  $("#manualRideForm").addEventListener("submit",e=>{e.preventDefault();const distance=Number($("#manualRideDistance").value);if(!Number.isFinite(distance)||distance<=0){toast("Enter a valid ride distance.");return;}state.rides.push({id:uid(),name:$("#rideName").value.trim()||"Bike ride",date:$("#manualRideDate").value||todayKey(),distance:Math.round(distance*100)/100,notes:$("#rideNotes").value.trim(),points:[],completedAt:Date.now(),duration:0});save();renderTrackers();$("#manualRideForm").reset();$("#manualRideDate").value=todayKey();toast("Past ride saved.");});
  $("#startRide").addEventListener("click",startRide);$("#stopRide").addEventListener("click",()=>stopRide(true));
  document.addEventListener("click",e=>{const delWeight=e.target.closest("[data-delete-weight]");if(delWeight&&confirm("Delete this weight measurement?")){state.weightEntries=state.weightEntries.filter(x=>x.id!==delWeight.dataset.deleteWeight);save();renderTrackers();}const delRide=e.target.closest("[data-delete-ride]");if(delRide&&confirm("Delete this ride record?")){state.rides=state.rides.filter(x=>x.id!==delRide.dataset.deleteRide);save();renderTrackers();}const show=e.target.closest("[data-show-ride]");if(show)showRide(show.dataset.showRide);});
  document.addEventListener("click",e=>{if(e.target.closest('[data-page="trackers"]')){setTimeout(()=>{initRideMap();if(rideMap)rideMap.invalidateSize();},100);}});
  $("#profileButton").addEventListener("click",()=>toast("Your progress is saved on this device. Keep training!"));
  window.addEventListener("beforeunload",()=>{if(activeSession)save();if(rideWatchId!==null)navigator.geolocation.clearWatch(rideWatchId);if(rideTimer)clearInterval(rideTimer);});
  if("serviceWorker" in navigator && (location.protocol==="https:"||location.hostname==="localhost"))window.addEventListener("load",()=>navigator.serviceWorker.register("./service-worker.js").catch(()=>{}));
  renderAll();
})();