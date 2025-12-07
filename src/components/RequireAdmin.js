import { useEffect, useState } from "react";
import { auth, db } from "../firebase/firebase";
import { doc, getDoc } from "firebase/firestore";
import { Navigate } from "react-router-dom";

function RequireAdmin({ children }) {
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkRole = async () => {
      const uid = auth.currentUser?.uid;

      if (!uid) {
        setLoading(false);
        return;
      }

      const userRef = doc(db, "users", uid);
      const snap = await getDoc(userRef);

      if (snap.exists()) {
        setRole(snap.data().role);
      }

      setLoading(false);
    };

    checkRole();
  }, []);

  if (loading) return <div>Loading...</div>;

  if (role !== "admin") return <Navigate to="/catalog" />;

  return children;
}

export default RequireAdmin;
