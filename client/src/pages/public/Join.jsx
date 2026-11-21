import React, { useEffect } from "react";
import { Navigate, useParams } from "react-router-dom";
import { getToken } from "../../utils/auth";
import { savePendingInvite } from "../../utils/invite";

/** /join/CODE: keep the code until the person has an account, then send them on. */
export default function Join() {
  const { code } = useParams();
  const valid = /^[A-Za-z0-9]{4,16}$/.test(code || "");
  useEffect(() => {
    if (valid) savePendingInvite(code);
  }, [valid, code]);
  if (!valid) return <Navigate to="/" replace />;
  return <Navigate to={getToken() ? "/profile" : "/register"} replace />;
}
