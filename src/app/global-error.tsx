"use client";

// Түбірлік layout-тың өзі құласа ғана көрсетіледі (провайдерлер жоқ — сондықтан мәтін екі тілде, стиль ішінде).
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="kk">
      <body style={{ margin: 0, minHeight: "100dvh", display: "grid", placeItems: "center", fontFamily: "system-ui, sans-serif", background: "#f5f8ff", color: "#0b1533" }}>
        <main style={{ maxWidth: 420, padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 22, margin: "0 0 8px" }}>Бірдеңе дұрыс болмады</h1>
          <p style={{ margin: "0 0 4px", color: "#4b587a" }}>Деректеріңіз сақтаулы. Бетті қайта жүктеп көріңіз.</p>
          <p style={{ margin: "0 0 20px", color: "#4b587a" }}>Что-то пошло не так. Ваши данные сохранены — обновите страницу.</p>
          <button
            type="button"
            onClick={reset}
            style={{ border: 0, borderRadius: 16, padding: "12px 22px", fontSize: 16, fontWeight: 700, color: "#fff", background: "#0047ff", cursor: "pointer" }}
          >
            Қайталау / Повторить
          </button>
        </main>
      </body>
    </html>
  );
}
