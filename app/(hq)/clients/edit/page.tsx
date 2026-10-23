import { redirect } from "next/navigation";

export default function EditWithoutClient() {
  redirect("/clients");
}
