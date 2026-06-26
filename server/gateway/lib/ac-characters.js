import mysql from 'mysql2/promise';

let pool = null;

function getPool() {
  if (pool) return pool;
  const host = process.env.AC_MYSQL_HOST;
  if (!host) return null;

  pool = mysql.createPool({
    host,
    port: Number(process.env.AC_MYSQL_PORT || 3306),
    user: process.env.AC_MYSQL_USER || 'root',
    password: process.env.AC_MYSQL_PASSWORD || process.env.DOCKER_DB_ROOT_PASSWORD || 'password',
    database: process.env.AC_MYSQL_CHAR_DB || 'acore_characters',
    connectionLimit: 4,
    waitForConnections: true,
  });
  return pool;
}

const RACES = {
  1: 'Human', 2: 'Orc', 3: 'Dwarf', 4: 'Night Elf', 5: 'Undead',
  6: 'Tauren', 7: 'Gnome', 8: 'Troll', 10: 'Blood Elf', 11: 'Draenei',
};

const CLASSES = {
  1: 'Warrior', 2: 'Paladin', 3: 'Hunter', 4: 'Rogue', 5: 'Priest',
  6: 'Death Knight', 7: 'Shaman', 8: 'Mage', 9: 'Warlock', 11: 'Druid',
};

export async function listCharactersForWowLogin(wowLogin) {
  const db = getPool();
  if (!db || !wowLogin) return { available: false, characters: [] };

  const authDb = process.env.AC_MYSQL_AUTH_DB || 'acore_auth';
  const charDb = process.env.AC_MYSQL_CHAR_DB || 'acore_characters';

  try {
    const [accounts] = await db.query(
      `SELECT id, username FROM \`${authDb}\`.account WHERE username = ? LIMIT 1`,
      [wowLogin],
    );
    if (!accounts.length) {
      return { available: true, characters: [], accountId: null };
    }

    const accountId = accounts[0].id;
    const [rows] = await db.query(
      `SELECT guid, name, level, race, class, gender, online
       FROM \`${charDb}\`.characters
       WHERE account = ?
       ORDER BY level DESC, name ASC`,
      [accountId],
    );

    return {
      available: true,
      accountId,
      characters: rows.map((row) => ({
        guid: row.guid,
        name: row.name,
        level: row.level,
        race: RACES[row.race] || row.race,
        class: CLASSES[row.class] || row.class,
        gender: row.gender === 0 ? 'Male' : 'Female',
        online: Boolean(row.online),
      })),
    };
  } catch (error) {
    console.error('[ac-characters] query failed:', error.message);
    return { available: false, error: error.message, characters: [] };
  }
}