import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import Workspace from "../components/Workspace";

export default function NotFound() {
  return <Workspace title="Page not found">
    <div className="page-heading"><div><p className="page-kicker">Page not found</p><h1>Let's find your way back.</h1><p>This page is no longer here. Your workspace is a click away.</p></div></div>
    <Link className="button button-primary" href="/dashboard"><ArrowLeft size={16} /> Back to overview</Link>
  </Workspace>;
}
