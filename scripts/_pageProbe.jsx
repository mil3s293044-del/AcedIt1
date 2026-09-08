/**
 * The page harness checkPagesMount.mjs drives. One page per load, named in the
 * query string, so a page that hangs cannot stop the rest being checked.
 *
 * Lives under scripts/ rather than src/ so it is never an entry point of the
 * production build — only index.html is, and the dev server will serve this
 * on request.
 */
import React from "react";
import ReactDOM from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import "@/index.css";
import { LiveProvider } from "@/lib/LiveContext";
import { AuthProvider } from "@/lib/AuthContext";

// The same glob the router builds its route table from, so a page added later
// is covered without touching this file.
const mods = import.meta.glob("../src/pages/*.jsx");
const NAMES = Object.keys(mods)
    .map((p) => p.replace("../src/pages/", "").replace(".jsx", "")).sort();
window.__PAGES__ = NAMES;

class Catch extends React.Component {
    constructor(p) { super(p); this.state = { err: null }; }
    static getDerivedStateFromError(err) { return { err }; }
    componentDidCatch() { /* reported through window.__RESULT__ */ }
    render() {
        if (this.state.err) {
            window.__RESULT__ = `THREW: ${this.state.err?.message || this.state.err}`;
            return <span id="verdict" />;
        }
        return this.props.children;
    }
}

function One({ name }) {
    const [Comp, setComp] = React.useState(null);
    React.useEffect(() => {
        mods[`../src/pages/${name}.jsx`]()
            .then((m) => setComp(() => m.default || (() => <span />)))
            .catch((e) => { window.__RESULT__ = `IMPORT: ${e.message}`; });
    }, [name]);
    React.useEffect(() => {
        if (Comp && !window.__RESULT__) window.__RESULT__ = "ok";
    }, [Comp]);
    return Comp ? <Catch><Comp /></Catch> : null;
}

const name = new URLSearchParams(location.search).get("page");
ReactDOM.createRoot(document.getElementById("root")).render(
    <MemoryRouter initialEntries={["/"]}>
        <AuthProvider>
            <LiveProvider>{name ? <One name={name} /> : <span id="listed">ready</span>}</LiveProvider>
        </AuthProvider>
    </MemoryRouter>,
);
