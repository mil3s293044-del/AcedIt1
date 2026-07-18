import { Navigate } from "react-router-dom";

// The standalone timer page duplicated the polished pomodoro inside Study
// (which records real sessions, streaks, and XP through the server engine).
// One timer, one XP path — anyone landing on /Timer goes there.
export default function Timer() {
    return <Navigate to="/Study" replace />;
}
