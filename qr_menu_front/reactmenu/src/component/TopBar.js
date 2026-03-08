import { useLang } from "../LangContext";
import LangButton from "./LangButton";
import CustomerAuth from "./CustomerAuth";
import ModeSwitcher from "./ModeSwitcher";

const recTitles = {
  AM: "Առաջարկվող ապրանքներ",
  RU: "Рекомендуемые товары",
  EN: "Recommended items",
};

export default function TopBar() {
  const { lang } = useLang();
  const title = recTitles[lang] || recTitles.AM;

  return (
    <header className="top-bar">
      <div className="top-bar-left">
        <LangButton />
      </div>
      <h1 className="top-bar-title">{title}</h1>
      <div className="top-bar-right">
        <CustomerAuth />
        <ModeSwitcher />
      </div>
    </header>
  );
}
