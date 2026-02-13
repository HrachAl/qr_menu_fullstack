import { useEffect, useState, useRef } from "react";
import { useLang } from "../LangContext";
import { IoChevronBack, IoChevronForward } from "react-icons/io5";

export default function Menu({ showMenu, setShowMenu }) {
  const [left, setLeft] = useState("0px");
  const [width, setWidth] = useState("92px");
  const [first, setFirst] = useState(0);
  const [sec, setSec] = useState(65);
  const [scroll, setScroll] = useState(0);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const {menuTypes} = useLang()
  const itemRefs = useRef([]);
  const listRef = useRef(null);

const handleClick = (index) => {
  const el = itemRefs.current[index];
  const container = listRef.current;
  if (!el || !container) return;

  const elOffsetLeft = el.offsetLeft;
  const elWidth = el.offsetWidth;
  const elRight = elOffsetLeft + elWidth;

  const containerScrollLeft = container.scrollLeft;
  const containerWidth = container.offsetWidth;
  const containerVisibleRight = containerScrollLeft + containerWidth;

  let first = 0;
  let second = 100;

  let relativeLeft = elOffsetLeft - 3.5;
  let width = elWidth + 8;

  if (relativeLeft - containerScrollLeft <= 5) {
    width += 20;
    second = 65;
  }
  else if (elRight >= containerVisibleRight - 5) { 
    width += 30;
    first = 40;
    relativeLeft -= 25;
  }

  setLeft(`${relativeLeft}px`);
  setWidth(`${width}px`);
  setFirst(first);
  setSec(second);
};

  const updateScrollButtons = () => {
    const ul = listRef.current;
    if (!ul) return;

    const maxScrollLeft = ul.scrollWidth - ul.clientWidth;
    const current = ul.scrollLeft;

    setCanScrollLeft(current > 2);
    setCanScrollRight(current < maxScrollLeft - 2);
  };

  const scrollByAmount = (dir) => {
    const ul = listRef.current;
    if (!ul) return;

    const amount = Math.max(220, Math.floor(ul.clientWidth * 0.6));
    ul.scrollBy({ left: dir === "left" ? -amount : amount, behavior: "smooth" });
  };

  useEffect(() => {
    const handleScroll = () => {
      setScroll(window.scrollY);
    };
    window.addEventListener("scroll", handleScroll);
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    updateScrollButtons();
  }, [menuTypes]);

  useEffect(() => {
    const handleScroll = () => {
      setShowMenu(window.scrollY <= 335);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  function waitForScrollEnd(element, callback) {
    let lastLeft = element.scrollLeft;
    let sameCounter = 0;

    const check = () => {
      const currentLeft = element.scrollLeft;
      if (currentLeft === lastLeft) {
        sameCounter++;
        if (sameCounter > 5) return callback();
      } else {
        sameCounter = 0;
        lastLeft = currentLeft;
      }
      requestAnimationFrame(check);
    };

    requestAnimationFrame(check);
  }

  useEffect(() => {
    const sectionOrder = menuTypes.map(typeObj => typeObj.type);
    const currentSection = sectionOrder.findIndex((type) => {
      const el = document.getElementById(type);
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      return rect.top <= window.innerHeight / 4  && rect.bottom >= window.innerHeight / 4;
    });

    if (currentSection !== -1) {
      handleClick(currentSection);

      const menuEl = itemRefs.current[currentSection];
      const ul = listRef.current;

      if (menuEl && ul) {
        const elLeft = menuEl.offsetLeft;
        const elWidth = menuEl.offsetWidth;
        const ulWidth = ul.clientWidth;

        const scrollTo = elLeft - ulWidth / 2 + elWidth / 2;

        ul.scrollTo({
          left: scrollTo,
          behavior: "smooth",
        });

        waitForScrollEnd(ul, () => {
          handleClick(currentSection);
        });
      } else {
        handleClick(currentSection);
      }

    }
  }, [scroll]);

  return (
    <div className="container" style={{ position: showMenu ? '' : 'fixed' }}>
      <div className="buttons">
        <div className={`menuNav ${canScrollLeft ? "canLeft" : ""} ${canScrollRight ? "canRight" : ""}`}>
          <button
            className={`menuNavBtn left ${canScrollLeft ? "show" : ""}`}
            onClick={() => scrollByAmount("left")}
            type="button"
            aria-label="Scroll left"
          >
            <IoChevronBack />
          </button>

          <ul ref={listRef} onScroll={updateScrollButtons}>
            {menuTypes.map((item, i) => (
              <li key={i} ref={el => (itemRefs.current[i] = el)}>
                <a href={`#${item.type}`} onClick={() => handleClick(i)}>
                  {item.type_name}
                </a>
              </li>
            ))}
            <div className="active" style={{ left : `${left}`, width : `${width}`, clipPath : `polygon(${first}% 0%, ${sec}% 0%, 100% 100%, 0% 100%)`}} />
          </ul>

          <button
            className={`menuNavBtn right ${canScrollRight ? "show" : ""}`}
            onClick={() => scrollByAmount("right")}
            type="button"
            aria-label="Scroll right"
          >
            <IoChevronForward />
          </button>
        </div>
      </div>
    </div>
  );
}