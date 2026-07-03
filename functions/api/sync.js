export async function onRequestPost(context) {
  const req = context.request;
  const db = context.env.DB;

  if (!db) {
    return new Response(JSON.stringify({ error: "Database binding 'DB' not configured in Cloudflare Dashboard" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const { passcodeHash, clientUpdatedAt, trades, accounts, settings, sop } = body;

    if (!passcodeHash) {
      return new Response(JSON.stringify({ error: "Missing passcodeHash" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Query existing record
    const result = await db.prepare("SELECT * FROM user_sync WHERE profile_id = ?")
      .bind(passcodeHash)
      .first();

    // 1) First sync / No record found -> Insert client data
    if (!result) {
      await db.prepare(
        "INSERT INTO user_sync (profile_id, trades_data, accounts_data, settings_data, sop_data, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
      )
      .bind(
        passcodeHash,
        JSON.stringify(trades || []),
        JSON.stringify(accounts || []),
        JSON.stringify(settings || {}),
        JSON.stringify(sop || []),
        clientUpdatedAt || Date.now()
      )
      .run();

      return new Response(JSON.stringify({ status: "synced", serverUpdatedAt: clientUpdatedAt || Date.now() }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const serverUpdatedAt = result.updated_at || 0;

    // 2) Client has newer data -> Update server
    if (clientUpdatedAt > serverUpdatedAt) {
      await db.prepare(
        "UPDATE user_sync SET trades_data = ?, accounts_data = ?, settings_data = ?, sop_data = ?, updated_at = ? WHERE profile_id = ?"
      )
      .bind(
        JSON.stringify(trades || []),
        JSON.stringify(accounts || []),
        JSON.stringify(settings || {}),
        JSON.stringify(sop || []),
        clientUpdatedAt,
        passcodeHash
      )
      .run();

      return new Response(JSON.stringify({ status: "updated_server", serverUpdatedAt: clientUpdatedAt }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 3) Server has newer data -> Send to client to update local
    if (serverUpdatedAt > clientUpdatedAt) {
      return new Response(
        JSON.stringify({
          status: "updated_client",
          serverUpdatedAt: serverUpdatedAt,
          trades: JSON.parse(result.trades_data || "[]"),
          accounts: JSON.parse(result.accounts_data || "[]"),
          settings: JSON.parse(result.settings_data || "{}"),
          sop: JSON.parse(result.sop_data || "[]")
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // 4) Both are in sync
    return new Response(JSON.stringify({ status: "in_sync", serverUpdatedAt }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: `Sync failed: ${err.message || err}` }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
