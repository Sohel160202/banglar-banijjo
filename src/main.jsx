import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { supabase } from "./lib/supabase.js";

const spaces = [
  { name: "ঢাকা", type: "প্রধান শহর", value: "৳ ১,২০,০০০", tone: "green" },
  { name: "চট্টগ্রাম", type: "বন্দর ও বাণিজ্য", value: "৳ ৯৫,০০০", tone: "blue" },
  { name: "কক্সবাজার", type: "পর্যটন", value: "৳ ৭৫,০০০", tone: "amber" },
  { name: "সিলেট", type: "চা ও প্রবাসী আয়", value: "৳ ৬৫,০০০", tone: "violet" },
  { name: "রাজশাহী", type: "কৃষি ও শিক্ষা", value: "৳ ৫২,০০০", tone: "coral" },
  { name: "খুলনা", type: "শিল্প ও নদীবন্দর", value: "৳ ৫৮,০০০", tone: "teal" }
];

const boardSpaces = [
  { name: "শুরু", type: "বিশেষ", tone: "start" },
  { name: "ঢাকা", type: "প্রধান শহর", tone: "green" },
  { name: "বাজার সংবাদ", type: "ঘটনা", tone: "event" },
  { name: "বিদ্যুৎ বাংলা", type: "সেবা", tone: "blue" },
  { name: "চট্টগ্রাম", type: "বন্দর", tone: "blue" },
  { name: "বন্দর কর", type: "কর", tone: "tax" },
  { name: "সিলেট", type: "চা ও প্রবাসী আয়", tone: "violet" },
  { name: "রাজশাহী", type: "কৃষি ও শিক্ষা", tone: "coral" },
  { name: "নতুন সেতু", type: "পরিবহন", tone: "teal" },
  { name: "কক্সবাজার", type: "পর্যটন", tone: "amber" },
  { name: "পানি উন্নয়ন", type: "সেবা", tone: "blue" },
  { name: "খুলনা", type: "শিল্প ও নদীবন্দর", tone: "teal" }
];

const events = [
  { icon: "৳", title: "রমজানের বাজার", detail: "খাদ্য ও খুচরা ব্যবসায় আয় ২০% বৃদ্ধি", color: "gold" },
  { icon: "↗", title: "নতুন সেতু নির্মাণ", detail: "সংযুক্ত এলাকার জমির মূল্য বাড়বে", color: "blue" },
  { icon: "☁", title: "বর্ষার চাপ", detail: "নদীঘেঁষা সম্পত্তির আয় সাময়িক কমবে", color: "green" }
];

function App() {
  const [notice, setNotice] = useState("");
  const [showRoom, setShowRoom] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [session, setSession] = useState(null);
  const [authMode, setAuthMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [showJoin, setShowJoin] = useState(false);
  const [roomCode, setRoomCode] = useState("");
  const [roomMessage, setRoomMessage] = useState("");
  const [roomBusy, setRoomBusy] = useState(false);
  const [currentRoom, setCurrentRoom] = useState(null);
  const [lobbyPlayers, setLobbyPlayers] = useState([]);
  const [showLobby, setShowLobby] = useState(false);
  const [lobbyMessage, setLobbyMessage] = useState("");
  const [gameRoom, setGameRoom] = useState(null);
  const [gamePlayers, setGamePlayers] = useState([]);
  const [showGame, setShowGame] = useState(false);
  const [gameMessage, setGameMessage] = useState("");
  const [lastRoll, setLastRoll] = useState(null);
  const [rolling, setRolling] = useState(false);

  useEffect(() => {
    if (!supabase) return undefined;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => listener.subscription.unsubscribe();
  }, []);

  const handleAuth = async (event) => {
    event.preventDefault();
    if (!supabase) {
      setAuthMessage("প্রবেশ ব্যবস্থা সংযোগ করা হচ্ছে।");
      return;
    }
    setAuthMessage("ম্যাজিক লিংক পাঠানো হচ্ছে…");
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin }
    });
    setAuthMessage(error ? "লিংক পাঠানো যায়নি। ইমেইল ঠিকানাটি পরীক্ষা করুন।" : "আপনার ইমেইলে প্রবেশের লিংক পাঠানো হয়েছে। এই পৃষ্ঠায় ফিরে এলে আপনি সরাসরি খেলায় প্রবেশ করবেন।");
  };

  const signOut = async () => {
    await supabase?.auth.signOut();
    setNotice("আপনি বের হয়ে গেছেন");
  };

  useEffect(() => {
    if (!supabase || !currentRoom?.id) return undefined;
    const refreshRoom = async () => {
      const [{ data: room }, { data: players }] = await Promise.all([
        supabase.from("game_rooms").select("id, room_code, status, host_id, current_turn, round_number, state").eq("id", currentRoom.id).single(),
        supabase.from("game_players").select("id, user_id, seat, display_name, is_ready, cash, position, net_worth").eq("room_id", currentRoom.id).order("seat")
      ]);
      if (room) {
        setGameRoom(room);
        if (room.status === "active") {
          setShowGame(true);
          setShowLobby(false);
        }
      }
      setLobbyPlayers(players || []);
      setGamePlayers(players || []);
    };
    refreshRoom();
    const channel = supabase.channel("room-" + currentRoom.id)
      .on("postgres_changes", { event: "*", schema: "public", table: "game_players", filter: "room_id=eq." + currentRoom.id }, refreshRoom)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "game_rooms", filter: "id=eq." + currentRoom.id }, (payload) => {
        setGameRoom(payload.new);
        if (payload.new.status === "active") {
          setLobbyMessage("খেলা শুরু হয়েছে—বোর্ড প্রস্তুত করা হচ্ছে।");
          setShowLobby(false);
          setShowGame(true);
        }
        if (payload.new.state?.last_roll) setLastRoll(payload.new.state.last_roll);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentRoom?.id]);

  const openRoom = () => {
    if (!session) {
      setShowAuth(true);
      setNotice("খেলা শুরু করতে আগে প্রবেশ করুন");
      return;
    }
    setShowRoom(true);
    setNotice("নতুন খেলার ঘর তৈরির প্রস্তুতি চলছে");
  };

  const createRoom = async () => {
    if (!supabase || !session) return;
    setRoomBusy(true);
    setRoomMessage("খেলার ঘর তৈরি হচ্ছে…");
    const { data: edition, error: editionError } = await supabase.from("board_editions").select("id").eq("slug", "bangladesh-first-edition").single();
    if (editionError) {
      setRoomMessage("প্রথম সংস্করণটি এখনো প্রস্তুত নয়।");
      setRoomBusy(false);
      return;
    }
    const code = Array.from(crypto.getRandomValues(new Uint8Array(6)), (value) => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[value % 32]).join("");
    const { data: room, error: roomError } = await supabase.from("game_rooms").insert({ room_code: code, edition_id: edition.id, host_id: session.user.id }).select("id, room_code").single();
    if (roomError) {
      setRoomMessage("খেলার ঘর তৈরি করা যায়নি। আবার চেষ্টা করুন।");
      setRoomBusy(false);
      return;
    }
    const displayName = session.user.email?.split("@")[0] || "খেলোয়াড়";
    const { error: playerError } = await supabase.from("game_players").insert({ room_id: room.id, user_id: session.user.id, seat: 0, display_name: displayName });
    setRoomMessage(playerError ? "ঘর তৈরি হয়েছে, কিন্তু খেলোয়াড় যুক্ত করা যায়নি।" : `আপনার খেলার ঘর প্রস্তুত: ${room.room_code}`);
    setRoomBusy(false);
    if (!playerError) {
      setCurrentRoom(room);
      setShowRoom(false);
      setShowLobby(true);
    }
  };

  const joinRoom = async (event) => {
    event.preventDefault();
    if (!supabase || !session) return;
    const cleanCode = roomCode.trim().toUpperCase();
    if (cleanCode.length !== 6) {
      setRoomMessage("ছয় অক্ষরের ঘর কোড লিখুন।");
      return;
    }
    setRoomBusy(true);
    setRoomMessage("খেলার ঘরে যোগ দেওয়া হচ্ছে…");
    const { data, error } = await supabase.rpc("join_room_by_code", { p_code: cleanCode });
    const result = data?.[0];
    setRoomMessage(error ? "ঘরে যোগ দেওয়া যায়নি।" : (result?.message || "ঘরে যোগ দেওয়া যায়নি।"));
    setRoomBusy(false);
    if (!error && result?.joined) {
      setCurrentRoom({ id: result.room_id, room_code: result.room_code });
      setShowJoin(false);
      setShowLobby(true);
    }
  };

  const toggleReady = async () => {
    if (!supabase || !session || !currentRoom) return;
    const currentPlayer = lobbyPlayers.find((player) => player.user_id === session.user.id);
    if (!currentPlayer) return;
    await supabase.from("game_players").update({ is_ready: !currentPlayer.is_ready }).eq("id", currentPlayer.id).eq("user_id", session.user.id);
  };

  const startGame = async () => {
    if (!supabase || !session || !currentRoom) return;
    setLobbyMessage("খেলা শুরু করা হচ্ছে…");
    const { error } = await supabase.from("game_rooms").update({ status: "active" }).eq("id", currentRoom.id).eq("host_id", session.user.id);
    if (error) {
      setLobbyMessage("শুধু ঘরের মালিক খেলা শুরু করতে পারবেন।");
      return;
    }
    setLobbyMessage("খেলা শুরু হয়েছে—বোর্ড প্রস্তুত করা হচ্ছে।");
  };

  const rollDice = async () => {
    if (!supabase || !currentRoom || rolling) return;
    setRolling(true);
    setGameMessage("পাশা গড়ানো হচ্ছে…");
    const { data, error } = await supabase.rpc("roll_dice", { p_room_id: currentRoom.id });
    const result = data?.[0];
    if (error || !result?.total) {
      setGameMessage(error ? "চাল দেওয়া যায়নি।" : (result?.message || "এখন চাল দেওয়া যাবে না।"));
    } else {
      setLastRoll(result);
      setGameMessage(result.message);
    }
    setRolling(false);
  };

  return (
    <main className="app-shell">
      <nav className="topbar">
        <div className="brand">
          <div className="brand-mark">ব</div>
          <div>
            <span className="brand-name">বাংলার বাণিজ্য</span>
            <span className="brand-caption">শহর • ব্যবসা • প্রভাব</span>
          </div>
        </div>
        <div className="top-actions">
          <button className="quiet-button" onClick={() => setNotice("নিয়মাবলি শিগগিরই প্রকাশিত হবে")}>নিয়মাবলি</button>
          <button className="profile-button" onClick={() => session ? signOut() : setShowAuth(true)}>
            <span className="avatar">{session ? "আ" : "অ"}</span>
            <span>{session ? "বের হয়ে যান" : "প্রবেশ করুন"}</span>
            <span className="chevron">⌄</span>
          </button>
        </div>
      </nav>

      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow"><span className="live-dot" /> আজকের বাজার সক্রিয়</div>
          <h1>আপনার শহর।<br /><em>আপনার বাণিজ্য।</em></h1>
          <p>বাংলাদেশের শহর, সম্পদ ও অর্থনীতিকে ঘিরে কৌশলের খেলা। সম্পত্তি কিনুন, ব্যবসা গড়ুন, সিদ্ধান্ত নিন—এবং পুরো মানচিত্রে আপনার প্রভাব তৈরি করুন।</p>
          <div className="hero-actions">
            <button className="primary-button" onClick={openRoom}>নতুন খেলা শুরু করুন <span>↗</span></button>
            <button className="secondary-button" onClick={() => { if (!session) { setShowAuth(true); setNotice("ঘরে যোগ দিতে আগে প্রবেশ করুন"); } else { setShowJoin(true); setRoomMessage(""); } }}>খেলার ঘরে যোগ দিন</button>
          </div>
          <div className="player-note"><span className="mini-avatars"><i>র</i><i>ম</i><i>স</i><i>+</i></span> ইতিমধ্যে ১২৪ জন খেলছেন</div>
        </div>

        <div className="hero-art">
          <div className="map-glow" />
          <div className="map-card">
            <div className="map-header"><span>বাংলাদেশের বাণিজ্য মানচিত্র</span><span className="map-status">● সরাসরি</span></div>
            <div className="map-body">
              <div className="map-river river-one" />
              <div className="map-river river-two" />
              <span className="map-pin pin-dhaka">ঢাকা</span>
              <span className="map-pin pin-chattogram">চট্টগ্রাম</span>
              <span className="map-pin pin-sylhet">সিলেট</span>
              <span className="map-pin pin-khulna">খুলনা</span>
              <span className="map-pin pin-rajshahi">রাজশাহী</span>
              <div className="map-stat stat-one"><strong>৳ ৩.৮</strong><small>মোট বাজারমূল্য</small></div>
              <div className="map-stat stat-two"><strong>৬</strong><small>সক্রিয় শহর</small></div>
            </div>
          </div>
          <div className="floating-card floating-income"><span className="float-icon">↗</span><div><small>এই রাউন্ডের আয়</small><strong>+৳ ৮,৪৫০</strong></div></div>
          <div className="floating-card floating-player"><span className="float-avatar">র</span><div><small>রাফি • ঢাকা</small><strong>সম্পত্তির রাজা</strong></div><span className="rank">#১</span></div>
        </div>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div><span className="section-kicker">খেলার জগত</span><h2>আজকের বাজারের অবস্থা</h2></div>
          <button className="text-button" onClick={() => setNotice("সম্পূর্ণ বাজার প্রতিবেদন শিগগিরই আসছে")}>সম্পূর্ণ প্রতিবেদন <span>↗</span></button>
        </div>
        <div className="market-grid">
          <article className="market-card market-primary"><div className="card-label">সক্রিয় খেলা</div><div className="market-number">১২৪</div><div className="trend positive">↗ ১৮% <span>গত ঘণ্টার তুলনায়</span></div><div className="sparkline"><i /><i /><i /><i /><i /><i /><i /><i /></div></article>
          <article className="market-card"><div className="card-label">সবচেয়ে চাহিদার শহর</div><div className="city-highlight"><div className="city-icon">ঢা</div><div><strong>ঢাকা</strong><span>চাহিদা সূচক ৯২</span></div><b>+২৪%</b></div><div className="progress"><span style={{width:"92%"}} /></div></article>
          <article className="market-card"><div className="card-label">গড় খেলোয়াড় সম্পদ</div><div className="market-number">৳ ৪.৬<span className="unit"> লাখ</span></div><div className="trend positive">↗ ৬.৪% <span>এই সপ্তাহে</span></div><div className="bar-chart"><i style={{height:"30%"}} /><i style={{height:"42%"}} /><i style={{height:"36%"}} /><i style={{height:"64%"}} /><i style={{height:"52%"}} /><i style={{height:"78%"}} /><i style={{height:"92%"}} /></div></article>
        </div>
      </section>

      <section className="section-block board-section">
        <div className="section-heading"><div><span className="section-kicker">প্রথম সংস্করণ</span><h2>বাংলাদেশের মানচিত্র</h2></div><span className="edition-badge">শিগগিরই খেলা যাবে</span></div>
        <div className="board-layout">
          <div className="board-preview">
            <div className="board-center"><div className="center-seal">বাংলার<br /><strong>বাণিজ্য</strong><small>প্রথম সংস্করণ</small></div></div>
            {spaces.map((space, index) => <button key={space.name} className={`board-space space-${index + 1} ${space.tone}`} onClick={() => setNotice(`${space.name} — ${space.type}, মূল্য ${space.value}`)}><span>{space.name}</span><small>{space.value}</small></button>)}
            <div className="board-corner corner-one">শুরু</div><div className="board-corner corner-two">বাজার</div><div className="board-corner corner-three">কর</div><div className="board-corner corner-four">বিশ্রাম</div>
          </div>
          <div className="board-details">
            <div className="detail-intro"><span className="detail-number">০১</span><div><h3>শহর থেকে সাম্রাজ্য</h3><p>প্রথম সংস্করণে বাংলাদেশের গুরুত্বপূর্ণ শহর ও অর্থনৈতিক অঞ্চলগুলোকে ঘিরে আপনার বাণিজ্য গড়ে তুলুন।</p></div></div>
            <div className="feature-list">
              <div><span className="feature-icon green-icon">⌂</span><div><strong>জমি কিনুন</strong><p>বাসাবাড়ি, বাজার ও বাণিজ্যিক অঞ্চল নিজের করে নিন।</p></div></div>
              <div><span className="feature-icon gold-icon">৳</span><div><strong>ব্যবসা চালান</strong><p>বিদ্যুৎ, পানি, গ্যাস ও ইন্টারনেটের বাজার নিয়ন্ত্রণ করুন।</p></div></div>
              <div><span className="feature-icon blue-icon">⚖</span><div><strong>সিদ্ধান্ত নিন</strong><p>রাজনীতি ও অর্থনীতির পরিবর্তনে আপনার কৌশল বদলান।</p></div></div>
            </div>
          </div>
        </div>
      </section>

      <section className="section-block event-section">
        <div className="section-heading"><div><span className="section-kicker">চলমান পরিস্থিতি</span><h2>আজকের বিশেষ ঘটনা</h2></div><button className="text-button" onClick={() => setNotice("নতুন ঘটনা প্রতি রাউন্ডে যুক্ত হবে")}>সব ঘটনা দেখুন <span>↗</span></button></div>
        <div className="event-grid">{events.map(event => <article className="event-card" key={event.title}><span className={`event-icon ${event.color}`}>{event.icon}</span><div><strong>{event.title}</strong><p>{event.detail}</p></div><span className="event-arrow">↗</span></article>)}</div>
      </section>

      <footer><span>বাংলার বাণিজ্য</span><span>বাংলার শহর, আপনার সিদ্ধান্ত</span><span>© ২০২৬</span></footer>

      {showAuth && <div className="modal-backdrop" onClick={() => setShowAuth(false)}><div className="room-modal auth-modal" onClick={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setShowAuth(false)}>×</button><span className="section-kicker">খেলোয়াড়ের প্রবেশ</span><h2>ম্যাজিক লিংক দিয়ে প্রবেশ করুন</h2><p>পাসওয়ার্ডের প্রয়োজন নেই। আপনার ইমেইলে একটি নিরাপদ প্রবেশের লিংক পাঠানো হবে।</p><form onSubmit={handleAuth} className="auth-form"><label>ইমেইল<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="আপনার ইমেইল" required /></label><button className="primary-button full-width" type="submit">ম্যাজিক লিংক পাঠান</button></form>{authMessage && <div className="auth-message">{authMessage}</div>}<small className="auth-note">লিংকটি কেবল আপনার জন্য তৈরি হবে এবং কিছুক্ষণ পর মেয়াদ শেষ হবে।</small></div></div>}
      {notice && <button className="toast" onClick={() => setNotice("")}>{notice}<span>×</span></button>}
      {showRoom && <div className="modal-backdrop" onClick={() => setShowRoom(false)}><div className="room-modal" onClick={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setShowRoom(false)}>×</button><span className="section-kicker">নতুন খেলা</span><h2>আপনার বাণিজ্যিক যাত্রা শুরু করুন</h2><p>আপনি ঘর তৈরি করলে অন্য খেলোয়াড়রা একটি কোড ব্যবহার করে যোগ দিতে পারবে।</p><div className="room-preview"><span>প্রথম সংস্করণ</span><strong>বাংলাদেশের মানচিত্র</strong><small>২–৬ জন খেলোয়াড় • ব্যক্তিগত ঘর</small></div>{roomMessage && <div className="auth-message">{roomMessage}</div>}<button className="primary-button full-width" disabled={roomBusy} onClick={createRoom}>{roomBusy ? "তৈরি হচ্ছে…" : "খেলার ঘর তৈরি করুন"}</button></div></div>}
      {showGame && <div className="game-screen"><div className="game-topbar"><div><span className="section-kicker">বাংলাদেশের মানচিত্র • প্রথম সংস্করণ</span><h2>খেলার মাঠ</h2></div><div className="game-top-actions"><span>রাউন্ড {gameRoom?.round_number || 1}</span><button onClick={() => setShowGame(false)}>অপেক্ষাকক্ষে ফিরুন</button></div></div><div className="game-layout"><div className="live-board">{boardSpaces.map((space, index) => <div className={"live-space " + space.tone} key={space.name}><span className="live-space-number">{index + 1}</span><strong>{space.name}</strong><small>{space.type}</small><div className="tokens">{gamePlayers.filter((player) => player.position === index).map((player) => <span key={player.id} title={player.display_name}>{player.display_name?.[0] || "খ"}</span>)}</div></div>)}<div className="live-board-center"><span>বাংলার</span><strong>বাণিজ্য</strong><small>সিদ্ধান্তই শক্তি</small></div></div><aside className="game-sidebar"><div className="turn-card"><span className="section-kicker">বর্তমান চাল</span><h3>{gamePlayers.find((player) => player.seat === gameRoom?.current_turn)?.display_name || "খেলোয়াড়"}</h3><p>{gamePlayers.find((player) => player.seat === gameRoom?.current_turn)?.user_id === session?.user?.id ? "এখন আপনার পালা" : "অন্য খেলোয়াড় চাল দিচ্ছেন"}</p><button className="primary-button full-width" disabled={gamePlayers.find((player) => player.seat === gameRoom?.current_turn)?.user_id !== session?.user?.id || rolling} onClick={rollDice}>{rolling ? "পাশা গড়ানো হচ্ছে…" : "পাশা গড়ান"}</button></div><div className="roll-card"><span className="section-kicker">শেষ চাল</span>{lastRoll ? <><div className="dice-result"><b>{lastRoll.die_one}</b><b>{lastRoll.die_two}</b><strong>= {lastRoll.total}</strong></div><p>{gameMessage || lastRoll.message}</p></> : <p>খেলা শুরু হলে প্রথম চাল এখানে দেখা যাবে।</p>}</div><div className="player-list-card"><span className="section-kicker">খেলোয়াড়েরা</span>{gamePlayers.map((player) => <div className={"game-player-row " + (player.seat === gameRoom?.current_turn ? "active-turn" : "")} key={player.id}><span className="lobby-avatar">{player.display_name?.[0] || "খ"}</span><div><strong>{player.display_name}</strong><small>অবস্থান {player.position + 1}</small></div><b>৳ {Number(player.cash || 0).toLocaleString("bn-BD")}</b></div>)}</div></aside></div></div>}
      {showLobby && <div className="modal-backdrop" onClick={() => setShowLobby(false)}><div className="room-modal lobby-modal" onClick={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setShowLobby(false)}>×</button><span className="section-kicker">খেলার অপেক্ষাকক্ষ</span><h2>বন্ধুদের সঙ্গে যোগ দিন</h2><p>এই কোডটি বন্ধুদের পাঠান। সবাই প্রস্তুত হলে ঘরের মালিক খেলা শুরু করতে পারবেন।</p><div className="room-code-card"><span>ঘরের কোড</span><strong>{currentRoom?.room_code || "------"}</strong><button onClick={() => navigator.clipboard?.writeText(currentRoom?.room_code || "")}>কপি করুন</button></div><div className="lobby-list">{lobbyPlayers.map((player, index) => <div className="lobby-player" key={player.id}><span className="lobby-avatar">{player.display_name?.[0] || "খ"}</span><div><strong>{player.display_name}</strong><small>{index === 0 ? "ঘরের মালিক" : `খেলোয়াড় ${index + 1}`}</small></div><span className={`ready-state ${player.is_ready ? "ready" : ""}`}>{player.is_ready ? "প্রস্তুত" : "অপেক্ষায়"}</span></div>)}</div>{lobbyMessage && <div className="auth-message">{lobbyMessage}</div>}<div className="lobby-actions"><button className="secondary-button" onClick={toggleReady}>{lobbyPlayers.find((player) => player.user_id === session?.user?.id)?.is_ready ? "প্রস্তুতি বাতিল করুন" : "আমি প্রস্তুত"}</button>{lobbyPlayers[0]?.user_id === session?.user?.id && <button className="primary-button" onClick={startGame}>খেলা শুরু করুন</button>}</div></div></div>}
      {showJoin && <div className="modal-backdrop" onClick={() => setShowJoin(false)}><div className="room-modal" onClick={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setShowJoin(false)}>×</button><span className="section-kicker">খেলায় যোগ দিন</span><h2>ঘরের কোড লিখুন</h2><p>আপনার বন্ধুর দেওয়া ছয় অক্ষরের কোড ব্যবহার করে খেলার ঘরে প্রবেশ করুন।</p><form className="auth-form" onSubmit={joinRoom}><label>ঘরের কোড<input value={roomCode} onChange={(event) => setRoomCode(event.target.value.toUpperCase())} placeholder="যেমন: AB12CD" maxLength="6" required /></label><button className="primary-button full-width" disabled={roomBusy} type="submit">{roomBusy ? "খোঁজা হচ্ছে…" : "ঘরে যোগ দিন"}</button></form>{roomMessage && <div className="auth-message">{roomMessage}</div>}</div></div>}
    </main>
  );
}

createRoot(document.getElementById("root")).render(<StrictMode><App /></StrictMode>);