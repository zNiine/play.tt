"""
Seed script — wipes existing teams/players/games/slates and reseeds
with real ALPB roster data. Game IDs will be 1-10.
"""
from app import create_app
from app.extensions import db
from app.models import (
    Team, Player, Game, Slate, SlateGame, SlatePlayer,
    GameLineup, LineupPlayer, PlayerGameStats,
    Entry, EntryPick, BTSEntry, BTSPick, WeeklyScore, Winner,
)
from datetime import datetime, timezone, date, timedelta
from sqlalchemy import text

app = create_app()

PLAYERS_CSV = """Ethan Brown,Hagerstown,P
MacCallan Conklin,Hagerstown,P
John Henriquez,Hagerstown,P
Anthony Imhoff,Hagerstown,P
Jordan Jackson,Hagerstown,P
Rafael Kelly,Hagerstown,P
Quinton Martinez,Hagerstown,P
Julian Minaya,Hagerstown,P
Branden Noriega,Hagerstown,P
Franklin Paulino,Hagerstown,P
Carlo Reyes,Hagerstown,P
Jake Shapley,Hagerstown,P
Andrew Simone,Hagerstown,P
Jack Weisenburger,Hagerstown,P
Robby Barham,Hagerstown,C
Mark Black,Hagerstown,C
Andrew Semo,Hagerstown,C
Osvaldo Abreu,Hagerstown,1B
Justin Acal,Hagerstown,1B
Brenny Escanio,Hagerstown,3B
Gary Mattis,Hagerstown,2B
Slater Schield,Hagerstown,2B
Cary Arbolida,Hagerstown,LF
Bryce Cannon,Hagerstown,RF
Aaron Takacs,Hagerstown,LF
Tyler Williams,Hagerstown,RF
Marty Costes,Hagerstown,RF
David Richardson,Hagerstown,P
Cam Williams,Hagerstown,1B
Brock Bell,Lancaster Stormers,P
Noah Bremer,Lancaster Stormers,P
Phillip Diehl,Lancaster Stormers,P
Scott Engler,Lancaster Stormers,P
Ryley Gilliam,Lancaster Stormers,P
Max Green,Lancaster Stormers,P
Kyle Johnson,Lancaster Stormers,P
Keylan Killgore,Lancaster Stormers,P
Michael McAvene,Lancaster Stormers,P
Luke McCollough,Lancaster Stormers,P
Jackson Rees,Lancaster Stormers,P
Noah Skirrow,Lancaster Stormers,P
Billy Sullivan,Lancaster Stormers,P
Matt Swarmer,Lancaster Stormers,P
Brendan White,Lancaster Stormers,P
Alex Isola,Lancaster Stormers,C
Luis Castro,Lancaster Stormers,SS
Yeison Coca,Lancaster Stormers,1B
Mason Martin,Lancaster Stormers,1B
Melvin Mercedes,Lancaster Stormers,1B
Daniel Amaral,Lancaster Stormers,LF
Quincy Hamilton,Lancaster Stormers,LF
Kevin Watson Jr.,Lancaster Stormers,LF
Joseph Carpenter,Lancaster Stormers,1B
Alex Garbrick,Lancaster Stormers,P
Trace Loehr,Lancaster Stormers,1B
Ariel Sandoval,Lancaster Stormers,RF
Jacob Asa,Long Island,P
Brad Case,Long Island,P
Nolan Clenney,Long Island,P
Garrett Crowley,Long Island,P
Juan Hillman,Long Island,P
Tanner Jacobson,Long Island,P
Ryan Langford,Long Island,P
Andrew Misiaszek,Long Island,P
Braydon Nelson,Long Island,P
Michael Reed,Long Island,P
Sal Romano,Long Island,P
Ryan Sandberg,Long Island,P
Ramon Santos,Long Island,P
Leonardo Taveras,Long Island,P
Aaron Antonini,Long Island,C
Ronaldo Flores,Long Island,C
Seth Beer,Long Island,2B
Ivan Castillo,Long Island,SS
Austin Dennis,Long Island,2B
Kole Kaler,Long Island,SS
Chad Pike,Long Island,P
Troy Viola,Long Island,3B
Leobaldo Cabrera,Long Island,LF
Taylor Kohlwey,Long Island,LF
Cody Thomas,Long Island,RF
River Town,Long Island,CF
Jonah Dipoto,Long Island,P
Mark Mathias,Long Island,3B
Keynan Middleton,Long Island,P
Justin OConner,Long Island,C
Chris Roller,Long Island,CF
Sterling Sharp,Long Island,P
Peyton Williams,Long Island,P
Christian Allegretti,Staten Island Ferry Hawks,P
Robbie Baker,Staten Island Ferry Hawks,P
Clay Helvey,Staten Island Ferry Hawks,P
Leandro Hernandez,Staten Island Ferry Hawks,P
Rob Kaminsky,Staten Island Ferry Hawks,P
Ryan Kehoe,Staten Island Ferry Hawks,P
Trayson Kubo,Staten Island Ferry Hawks,P
Taylor Lepard,Staten Island Ferry Hawks,P
Alex Mack,Staten Island Ferry Hawks,P
Brian McKenna,Staten Island Ferry Hawks,P
James Meeker,Staten Island Ferry Hawks,P
Nate Roe,Staten Island Ferry Hawks,P
Wesley Scott,Staten Island Ferry Hawks,P
Kirby Snead,Staten Island Ferry Hawks,P
Matt Zguro,Staten Island Ferry Hawks,P
Albert Espinosa,Staten Island Ferry Hawks,C
David Melfi,Staten Island Ferry Hawks,C
Eddy Diaz,Staten Island Ferry Hawks,2B
Collin Jensen,Staten Island Ferry Hawks,2B
Drew Maggi,Staten Island Ferry Hawks,3B
Alberto Osuna,Staten Island Ferry Hawks,1B
Cristhian Rodriguez,Staten Island Ferry Hawks,1B
Pablo Sandoval,Staten Island Ferry Hawks,SS
Vaun Brown,Staten Island Ferry Hawks,LF
Mark Contreras,Staten Island Ferry Hawks,CF
Tyler Dearden,Staten Island Ferry Hawks,LF
Kolby Johnson,Staten Island Ferry Hawks,CF
Jimmy Burnette,York,P
Alex Bustamante,York,P
Brendan Cellucci,York,P
Ian Churchill,York,P
Mike Kickham,York,P
Nick Mikolajchak,York,P
Kevin Miranda,York,P
Josh Mollerus,York,P
Jordan Morales,York,P
Cam Robinson,York,P
Braden Scott,York,P
Grayson Thurman,York,P
Chris Vallimont,York,P
Alex Valverde,York,P
Omar Veloz,York,C
Chris Williams,York,C
Jeremy Arocho,York,3B
Ryan Higgins,York,3B
Brandon Lewis,York,3B
Kyle Martin,York,1B
Jalen Miller,York,2B
Elvis Peralta,York,1B
Jeffrey Wehler,York,SS
Jaylin Davis,York,RF
Shayne Fontana,York,LF
Miles Simington,York,CF
Noah Denoyer,York,P
Adalberto Flores,York,P
Lukas Galdoni,York,P
Michael Horrell,York,P
Foster Pace,York,P
William Simoneit,York,C
Tariq Bacon,Charleston Dirty Birds,P
Emmett Bice,Charleston Dirty Birds,P
Maceo Campbell,Charleston Dirty Birds,P
Marc Davis,Charleston Dirty Birds,P
Anthony Diaz,Charleston Dirty Birds,P
Jamison Hill,Charleston Dirty Birds,P
Parker Kruglewicz,Charleston Dirty Birds,P
Nolan Lamere,Charleston Dirty Birds,P
Alejandro Lugo,Charleston Dirty Birds,P
Carlos Meza,Charleston Dirty Birds,P
Frank Moscatiello,Charleston Dirty Birds,P
Doug Olcese,Charleston Dirty Birds,P
Edison Suriel,Charleston Dirty Birds,P
Luis de Avila,Charleston Dirty Birds,P
Joe DeLuca,Charleston Dirty Birds,C
Thatcher Poteat,Charleston Dirty Birds,C
Alan Alonso,Charleston Dirty Birds,1B
Carlos Amezquita,Charleston Dirty Birds,3B
Benjamin Blackwell,Charleston Dirty Birds,3B
Dermis Garcia,Charleston Dirty Birds,1B
James Nelson,Charleston Dirty Birds,2B
TJ Nelson,Charleston Dirty Birds,1B
Jaylen Smith,Charleston Dirty Birds,1B
Alsander Womack,Charleston Dirty Birds,2B
Zach Daniels,Charleston Dirty Birds,RF
Demetrius Moorer,Charleston Dirty Birds,LF
Bryan Blanton,Gastonia Ghost Peppers,P
Sam Bordner,Gastonia Ghost Peppers,P
Connor Grey,Gastonia Ghost Peppers,P
Matt Hartman,Gastonia Ghost Peppers,P
Ryan Hennen,Gastonia Ghost Peppers,P
Nick Horvath,Gastonia Ghost Peppers,P
Thomas King,Gastonia Ghost Peppers,P
Jake Miednik,Gastonia Ghost Peppers,P
Ljay Newsome,Gastonia Ghost Peppers,P
Craig Stem,Gastonia Ghost Peppers,P
Cory Thompson,Gastonia Ghost Peppers,P
Duane Underwood Jr.,Gastonia Ghost Peppers,P
Zac Westcott,Gastonia Ghost Peppers,P
Tyler Wilson,Gastonia Ghost Peppers,P
Aaron McKeithan,Gastonia Ghost Peppers,C
Alexis Olmeda,Gastonia Ghost Peppers,C
Carter Aldrete,Gastonia Ghost Peppers,3B
Jonny Barditch,Gastonia Ghost Peppers,1B
Dalton Guthrie,Gastonia Ghost Peppers,2B
Shed Long Jr.,Gastonia Ghost Peppers,1B
Jack Reinheimer,Gastonia Ghost Peppers,SS
Justin Wylie,Gastonia Ghost Peppers,3B
Narciso Crook,Gastonia Ghost Peppers,CF
Eric De La Rosa,Gastonia Ghost Peppers,RF
Cole Roederer,Gastonia Ghost Peppers,CF
Nate Scantlin,Gastonia Ghost Peppers,LF
Raynel Espinal,Gastonia Ghost Peppers,P
Kent Hasler,Gastonia Ghost Peppers,P
Adam Scott,Gastonia Ghost Peppers,P
Cas Silber,Gastonia Ghost Peppers,P
Kevin Smith,Gastonia Ghost Peppers,P
Art Warren,Gastonia Ghost Peppers,P
John Wilson,Gastonia Ghost Peppers,P
Daniel Blair,High Point,P
Cam Cotter,High Point,P
Fin Del Bonta-Smith,High Point,P
Jake Gilbert,High Point,P
Kyle Halbohn,High Point,P
Josh Hendrickson,High Point,P
David Hess,High Point,P
Jameson McGrane,High Point,P
Scott Rouse,High Point,P
Yuhi Sako,High Point,P
Jonah Scolaro,High Point,P
Erich Uelmen,High Point,P
Ben Wereski,High Point,P
Isaiah Mirabal,High Point,C
Luke Napleton,High Point,C
Nolan Watson,High Point,C
Aidan Brewer,High Point,3B
D.J. Burt,High Point,3B
Braxton Davidson,High Point,2B
Evan Edwards,High Point,3B
Ben Aklinski,High Point,RF
Alex Dickerson,High Point,RF
Luis Gonzalez,High Point,RF
Jordan Luplow,High Point,LF
Bryson Parks,High Point,RF
Cody Wilson,High Point,RF
Mike Devine,High Point,P
Gabe Klobosits,High Point,P
Nick Longhi,High Point,1B
Dustin Beggs,Lexington Legends,P
Colton Eastman,Lexington Legends,P
Christian Edwards,Lexington Legends,P
Ben Ferrer,Lexington Legends,P
Simon Gregersen,Lexington Legends,P
Jonathan Haab,Lexington Legends,P
Carson Lambert,Lexington Legends,P
Jimmy Loper,Lexington Legends,P
Gil Luna,Lexington Legends,P
Jack Lynch,Lexington Legends,P
Kaleb Sophy,Lexington Legends,P
Brian Zeldin,Lexington Legends,P
Jerry Huntzinger,Lexington Legends,C
Isaias Quiroz,Lexington Legends,C
Andy Atwood,Lexington Legends,2B
Mason Dinesen,Lexington Legends,2B
Brenden Dixon,Lexington Legends,2B
Brian Fuentes,Lexington Legends,SS
JT Riddle,Lexington Legends,SS
EJ Cumbo,Lexington Legends,CF
Ronnie Dawson,Lexington Legends,RF
Ryan McCarthy,Lexington Legends,RF
Dylan Rock,Lexington Legends,RF
Xane Washington,Lexington Legends,LF
Jose Acosta,Lexington Legends,P
Jason Blanchard,So. Maryland,P
Endrys Briceño,So. Maryland,P
Jordan Carr,So. Maryland,P
Brandon McCabe,So. Maryland,P
Jalen Miller,So. Maryland,P
Connor Overton,So. Maryland,P
Dalton Ross,So. Maryland,P
Shawn Semple,So. Maryland,P
Cody Thompson,So. Maryland,P
Andrew Thurman,So. Maryland,P
Rafi Vazquez,So. Maryland,P
Kyle Virbitsky,So. Maryland,P
Jarod Wright,So. Maryland,P
Lyle Lin,So. Maryland,C
Ryan McCarthy,So. Maryland,C
Brett Barrera,So. Maryland,3B
Jamari Baylor,So. Maryland,3B
Sam Dexter,So. Maryland,SS
Ethan Skender,So. Maryland,1B
Cooper Weiss,So. Maryland,2B
Giovanni Digiacomo,So. Maryland,LF
Pearce Howard,So. Maryland,CF
Ethan Wilson,So. Maryland,RF"""

TEAM_CODES = {
    "Hagerstown":             ("HAG", "Hagerstown Flying Boxcars"),
    "Lancaster Stormers":     ("LAN", "Lancaster Stormers"),
    "Long Island":            ("LID", "Long Island Ducks"),
    "Staten Island Ferry Hawks": ("SIF", "Staten Island Ferry Hawks"),
    "York":                   ("YRK", "York Revolution"),
    "Charleston Dirty Birds": ("CHS", "Charleston Dirty Birds"),
    "Gastonia Ghost Peppers": ("GAS", "Gastonia Ghost Peppers"),
    "High Point":             ("HPT", "High Point Rockers"),
    "Lexington Legends":      ("LEX", "Lexington Legends"),
    "So. Maryland":           ("SOM", "Southern Maryland Blue Crabs"),
}

SALARY_MAP = {
    "P":  [9500, 9000, 8500, 8000, 7500, 7000, 6500, 6000],
    "C":  [5500, 5200, 4800, 4500],
    "1B": [8000, 7500, 7000, 6500, 6000, 5500],
    "2B": [7000, 6500, 6000, 5500, 5000],
    "3B": [7500, 7000, 6500, 6000, 5500],
    "SS": [8500, 8000, 7500, 7000, 6500],
    "LF": [7000, 6500, 6000, 5500, 5000],
    "CF": [8000, 7500, 7000, 6500, 6000],
    "RF": [7200, 6800, 6500, 6000, 5500],
    "DH": [6500, 6000, 5500],
}

with app.app_context():

    print("Nuking existing data...")
    db.session.execute(text("DELETE FROM entry_picks"))
    db.session.execute(text("DELETE FROM entries"))
    db.session.execute(text("DELETE FROM bts_picks"))
    db.session.execute(text("DELETE FROM bts_entries"))
    db.session.execute(text("DELETE FROM bts_user_state"))
    db.session.execute(text("DELETE FROM slate_players"))
    db.session.execute(text("DELETE FROM slate_games"))
    db.session.execute(text("DELETE FROM slates"))
    db.session.execute(text("DELETE FROM lineup_players"))
    db.session.execute(text("DELETE FROM game_lineups"))
    db.session.execute(text("DELETE FROM player_game_stats"))
    db.session.execute(text("DELETE FROM games"))
    db.session.execute(text("DELETE FROM players"))
    db.session.execute(text("DELETE FROM teams"))
    db.session.execute(text("DELETE FROM weekly_scores"))
    db.session.execute(text("DELETE FROM winners"))

    # Reset all sequences to 1
    for seq in ["teams_id_seq", "players_id_seq", "games_id_seq",
                "slates_id_seq", "slate_players_id_seq"]:
        db.session.execute(text(f"ALTER SEQUENCE {seq} RESTART WITH 1"))

    db.session.commit()
    print("Tables cleared and sequences reset.")

    # ── Teams ──────────────────────────────────────────────────────────────────
    teams = {}
    for full_name, (code, display_name) in TEAM_CODES.items():
        t = Team(team_code=code, team_name=display_name)
        db.session.add(t)
        db.session.flush()
        teams[full_name] = t
    db.session.flush()
    print("Teams:", {k: v.id for k, v in teams.items()})

    # ── Players ────────────────────────────────────────────────────────────────
    player_objects = []
    salary_counters = {}
    for line in PLAYERS_CSV.strip().splitlines():
        parts = line.strip().split(",")
        if len(parts) < 3:
            continue
        name = parts[0].strip()
        team_name = ",".join(parts[1:-1]).strip()
        pos = parts[-1].strip()
        team_obj = teams.get(team_name)
        if not team_obj:
            print(f"  WARNING: unknown team '{team_name}' for {name}")
            continue
        p = Player(
            full_name=name,
            primary_position=pos,
            team_id=team_obj.id,
            active=True,
        )
        db.session.add(p)
        player_objects.append((p, pos, team_name))
    db.session.flush()
    print(f"Players: {len(player_objects)} seeded")

    # ── Games 1-10 ─────────────────────────────────────────────────────────────
    team_list = list(TEAM_CODES.keys())
    matchups = [
        ("Hagerstown",             "Lancaster Stormers"),
        ("Long Island",            "Staten Island Ferry Hawks"),
        ("York",                   "Charleston Dirty Birds"),
        ("Gastonia Ghost Peppers", "High Point"),
        ("Lexington Legends",      "So. Maryland"),
        ("Lancaster Stormers",     "Long Island"),
        ("Staten Island Ferry Hawks", "York"),
        ("Charleston Dirty Birds", "Gastonia Ghost Peppers"),
        ("High Point",             "Hagerstown"),
        ("So. Maryland",           "Lexington Legends"),
    ]
    today = date.today()
    game_objects = []
    for i, (home_name, away_name) in enumerate(matchups):
        game_day = today if i < 5 else today + timedelta(days=1)
        start_dt = datetime(game_day.year, game_day.month, game_day.day, 19, 5, tzinfo=timezone.utc)
        g = Game(
            home_team_id=teams[home_name].id,
            away_team_id=teams[away_name].id,
            start_time=start_dt,
            status="scheduled",
            external_game_id=f"MOCK_{game_day}_{teams[home_name].team_code}_{teams[away_name].team_code}",
        )
        db.session.add(g)
        game_objects.append(g)
    db.session.flush()
    game_ids = [g.id for g in game_objects]
    print(f"Games: {game_ids}")

    # ── Slate for today (games 1-5) ────────────────────────────────────────────
    lock_dt = datetime(today.year, today.month, today.day, 19, 0, tzinfo=timezone.utc)
    slate = Slate(slate_date=today, lock_time=lock_dt, status="open")
    db.session.add(slate)
    db.session.flush()

    for g in game_objects[:5]:
        db.session.add(SlateGame(slate_id=slate.id, game_id=g.id))

    # ── Slate players — only those from today's game teams ────────────────────
    today_teams = set()
    for home_name, away_name in matchups[:5]:
        today_teams.add(home_name)
        today_teams.add(away_name)

    added = 0
    for p_obj, pos, team_name in player_objects:
        if team_name not in today_teams:
            continue
        sal_list = SALARY_MAP.get(pos, [5000])
        idx = salary_counters.get(pos, 0)
        salary = sal_list[idx % len(sal_list)]
        salary_counters[pos] = idx + 1
        db.session.add(SlatePlayer(
            slate_id=slate.id,
            player_id=p_obj.id,
            salary=salary,
            eligible_positions=[pos],
            active=True,
        ))
        added += 1

    db.session.commit()
    print(f"Slate #{slate.id} | {today} | {added} players eligible")
    print(f"Today's matchups: {', '.join(f'{a} @ {h}' for h,a in matchups[:5])}")
    print("Seed complete!")
