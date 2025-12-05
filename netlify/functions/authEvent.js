// netlify/functions/authEvent.js
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // clé service_role côté serveur UNIQUEMENT
);

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const data = JSON.parse(event.body);

    const { event_name, user_id, email, metadata } = data;

    const { error } = await supabase.from("auth_events").insert({
      event_name,
      user_id,
      email,
      metadata: metadata || {},
    });

    if (error) {
      console.error("DB error:", error);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "DB error" }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ status: "ok" }),
    };
  } catch (e) {
    console.error("Parse error:", e);
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Bad request" }),
    };
  }
};
