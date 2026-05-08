import { useState } from "react";
import { supabase } from "../../supabaseClient";

export default function AuthView() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      let result;
      if (isSignUp) {
        result = await supabase.auth.signUp({ email, password });
        if (!result.error) {
          setError("Account created! You can now log in.");
          setIsSignUp(false);
        }
      } else {
        result = await supabase.auth.signInWithPassword({ email, password });
      }
      
      if (result.error) {
        setError(result.error.message);
      }
    } catch (err) {
      setError(err.message);
    }
    
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: "100dvh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "var(--bg)",
      padding: 20,
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;1,6..72,400&display=swap');
        
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
          font-family: 'Newsreader', Georgia, serif;
          background: #faf8f5;
          color: #1a1a1a;
        }
        
        @media (prefers-color-scheme: dark) {
          body {
            background: #1a1a1a;
            color: #e5e5e5;
          }
        }
      `}</style>
      
      <div style={{
        background: "var(--bg-card, white)",
        border: "1px solid #e5e5e5",
        borderRadius: 16,
        padding: "40px 32px",
        width: "100%",
        maxWidth: 360,
        boxShadow: "0 8px 40px rgba(0,0,0,0.08)",
      }}>
        <div style={{
          textAlign: "center",
          marginBottom: 32,
        }}>
          <div style={{
            width: 48,
            height: 48,
            borderRadius: "50%",
            background: "#4a6fa5",
            margin: "0 auto 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            fontSize: 20,
          }}>
            ◎
          </div>
          <div style={{
            fontFamily: "'Newsreader', Georgia, serif",
            fontSize: 28,
            fontWeight: 600,
            color: "var(--text, #1a1a1a)",
          }}>
            Interstitial
          </div>
          <div style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: 14,
            color: "#999",
            marginTop: 4,
          }}>
            Your personal journal
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="Email address"
            required
            style={{
              width: "100%",
              padding: "12px 16px",
              border: "1px solid #e5e5e5",
              borderRadius: 8,
              marginBottom: 12,
              fontFamily: "'Inter', sans-serif",
              fontSize: 14,
              color: "var(--text, #1a1a1a)",
              background: "var(--bg, #faf8f5)",
              outline: "none",
            }}
          />
          
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Password"
            required
            minLength={6}
            style={{
              width: "100%",
              padding: "12px 16px",
              border: "1px solid #e5e5e5",
              borderRadius: 8,
              marginBottom: 16,
              fontFamily: "'Inter', sans-serif",
              fontSize: 14,
              color: "var(--text, #1a1a1a)",
              background: "var(--bg, #faf8f5)",
              outline: "none",
            }}
          />

          {error && (
            <div style={{
              padding: "10px 14px",
              background: error.includes("created") ? "rgba(74,124,89,0.1)" : "rgba(196,74,58,0.1)",
              color: error.includes("created") ? "#4a7c59" : "#c44a3a",
              borderRadius: 8,
              marginBottom: 16,
              fontFamily: "'Inter', sans-serif",
              fontSize: 13,
              lineHeight: 1.5,
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "12px",
              background: loading ? "#999" : "#1a1a1a",
              color: "white",
              border: "none",
              borderRadius: 8,
              cursor: loading ? "default" : "pointer",
              fontFamily: "'Inter', sans-serif",
              fontSize: 16,
              fontWeight: 500,
              transition: "opacity 0.15s",
            }}
            onMouseEnter={e => {
              if (!loading) e.currentTarget.style.opacity = 0.9;
            }}
            onMouseLeave={e => {
              if (!loading) e.currentTarget.style.opacity = 1;
            }}
          >
            {loading ? "Processing..." : (isSignUp ? "Create Account" : "Log In")}
          </button>
        </form>

        <button
          onClick={() => {
            setIsSignUp(!isSignUp);
            setError("");
          }}
          style={{
            width: "100%",
            padding: "12px",
            background: "none",
            border: "none",
            cursor: "pointer",
            fontFamily: "'Inter', sans-serif",
            fontSize: 13,
            color: "#999",
            marginTop: 12,
            textDecoration: "underline",
          }}
        >
          {isSignUp ? "Already have an account? Log In" : "Need an account? Sign Up"}
        </button>
      </div>
    </div>
  );
}