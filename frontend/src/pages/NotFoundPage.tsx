import { Link } from "react-router-dom";
import { EmptyState } from "../components/ui";

export default function NotFoundPage() {
  return (
    <EmptyState
      title="Page not found"
      action={
        <Link className="btn btn-primary" to="/">
          Back to ProofMesh
        </Link>
      }
    >
      <p>That route doesn't exist. Check the URL, or start from the home page.</p>
    </EmptyState>
  );
}
