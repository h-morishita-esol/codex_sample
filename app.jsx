const { useState, useEffect, useMemo, useRef } = React;

const LOCAL_STORAGE_KEY = "club-expense-data-v1";

const generateId = (prefix) => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  const random = Math.random().toString(16).slice(2, 10);
  const timestamp = Date.now().toString(16);
  return `${prefix}-${timestamp}${random}`;
};

const getTodayIso = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatCurrency = (value) => `${Number(value || 0).toLocaleString("ja-JP")}\u5186`;

const formatDateDisplay = (isoDate) => {
  if (!isoDate) return "";
  const [year, month, day] = isoDate.split("-");
  return `${Number(month)}/${Number(day)}`;
};

const ASSETS_TO_TRACK = [
  { name: "index.html", url: "./index.html" },
  { name: "app.jsx", url: "./app.jsx" },
  { name: "service-worker.js", url: "./service-worker.js" },
  { name: "styles.css", url: "./styles.css" },
];

const formatAssetTimestamp = (value) => {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
};

const createInitialData = () => {
  const memberId = generateId("member");
  const dateId = generateId("date");
  const today = getTodayIso();

  return {
    members: [
      {
        id: memberId,
        name: "華道花子",
        className: "2-3",
      },
    ],
    expenseDays: [
      {
        id: dateId,
        date: today,
        amount: 1000,
      },
    ],
    attendance: {
      [memberId]: {
        [dateId]: false,
      },
    },
  };
};

const ensureAttendanceCompleteness = (data) => {
  const attendance = { ...data.attendance };
  data.members.forEach((member) => {
    const map = { ...(attendance[member.id] || {}) };
    data.expenseDays.forEach((day) => {
      if (typeof map[day.id] !== "boolean") {
        map[day.id] = false;
      }
    });
    attendance[member.id] = map;
  });

  Object.keys(attendance).forEach((memberId) => {
    if (!data.members.find((member) => member.id === memberId)) {
      delete attendance[memberId];
    }
  });

  return {
    ...data,
    attendance,
  };
};

const sanitizeData = (raw) => {
  if (!raw || typeof raw !== "object") {
    return createInitialData();
  }

  const members = Array.isArray(raw.members)
    ? raw.members
        .filter((item) => item && item.id && item.name && item.className)
        .map((item) => ({
          id: String(item.id),
          name: String(item.name),
          className: String(item.className),
        }))
    : [];

  const expenseDays = Array.isArray(raw.expenseDays)
    ? raw.expenseDays
        .filter((item) => item && item.id && item.date && item.amount !== undefined)
        .map((item) => ({
          id: String(item.id),
          date: String(item.date),
          amount: Math.max(0, Math.round(Number(item.amount) || 0)),
        }))
    : [];

  const attendance = raw.attendance && typeof raw.attendance === "object" ? raw.attendance : {};

  if (!members.length || !expenseDays.length) {
    return createInitialData();
  }

  return ensureAttendanceCompleteness({ members, expenseDays, attendance });
};

const loadInitialState = () => {
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!stored) {
      const initial = createInitialData();
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
    const parsed = JSON.parse(stored);
    return sanitizeData(parsed);
  } catch (error) {
    console.warn("Failed to load stored data, using defaults", error);
    const fallback = createInitialData();
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(fallback));
    return fallback;
  }
};

const downloadJson = (data) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `club-expense-${getTodayIso()}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
const reorderMembers = (members, sourceId, targetId) => {
  const sourceIndex = members.findIndex((member) => member.id === sourceId);
  const targetIndex = members.findIndex((member) => member.id === targetId);
  if (sourceIndex === -1 || targetIndex === -1) {
    return members;
  }
  if (sourceIndex === targetIndex) {
    return members;
  }
  if (sourceIndex < targetIndex && sourceIndex + 1 === targetIndex) {
    return members;
  }
  const updated = [...members];
  const [moved] = updated.splice(sourceIndex, 1);
  const nextIndex = sourceIndex < targetIndex ? targetIndex - 1 : targetIndex;
  updated.splice(nextIndex, 0, moved);
  return updated;
};

const validateImportedData = (data) => {
  if (!data || typeof data !== "object") {
    throw new Error("JSONの形式が正しくありません。");
  }
  if (!Array.isArray(data.members) || !Array.isArray(data.expenseDays)) {
    throw new Error("members または expenseDays が不足しています。");
  }
  if (!data.members.length) {
    throw new Error("部員のデータが含まれていません。");
  }
  if (!data.expenseDays.length) {
    throw new Error("日付のデータが含まれていません。");
  }
  return sanitizeData(data);
};

const PULL_TO_REFRESH_THRESHOLD = 80;
const PULL_TO_REFRESH_MAX_DISTANCE = 120;
const PULL_TO_REFRESH_INDICATOR_HEIGHT = 56;

function MemberDialog({ open, initialValue, onSubmit, onDelete, onClose }) {
  const [name, setName] = useState(initialValue?.name ?? "");
  const [className, setClassName] = useState(initialValue?.className ?? "");
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setName(initialValue?.name ?? "");
      setClassName(initialValue?.className ?? "");
      setError("");
    }
  }, [open, initialValue]);

  if (!open) return null;

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!name.trim()) {
      setError("名前を入力してください。");
      return;
    }
    if (!className.trim()) {
      setError("クラス名を入力してください。");
      return;
    }

    onSubmit({
      ...(initialValue ?? {}),
      name: name.trim(),
      className: className.trim(),
    });
  };

  return (
    <div className="dialog-backdrop" role="dialog" aria-modal="true">
      <div className="dialog">
        <h2>{initialValue ? "部員を編集" : "部員を追加"}</h2>
        <form id="member-dialog-form" onSubmit={handleSubmit}>
          <label>
            名前
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="例：華道花子" />
          </label>
          <label>
            クラス名
            <input value={className} onChange={(event) => setClassName(event.target.value)} placeholder="例：2-3" />
          </label>
          {error && <span className="caption" style={{ color: "#e53935" }}>{error}</span>}
        </form>
        <div className="dialog-footer">
          {initialValue && onDelete && (
            <button type="button" className="danger" onClick={() => onDelete(initialValue.id)}>
              削除
            </button>
          )}
          <button type="button" className="secondary" onClick={onClose}>
            キャンセル
          </button>
          <button type="submit" className="primary" form="member-dialog-form">
            保存
          </button>
        </div>
      </div>
    </div>
  );
}

function DateDialog({ open, initialValue, onSubmit, onDelete, onClose }) {
  const [date, setDate] = useState(initialValue?.date ?? getTodayIso());
  const [amount, setAmount] = useState(initialValue?.amount ?? 0);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setDate(initialValue?.date ?? getTodayIso());
      setAmount(initialValue?.amount ?? 0);
      setError("");
    }
  }, [open, initialValue]);

  if (!open) return null;

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!date) {
      setError("日付を入力してください。");
      return;
    }
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount < 0) {
      setError("金額は0以上の数値で入力してください。");
      return;
    }

    onSubmit({
      ...(initialValue ?? {}),
      date,
      amount: Math.round(numericAmount),
    });
  };

  return (
    <div className="dialog-backdrop" role="dialog" aria-modal="true">
      <div className="dialog">
        <h2>{initialValue ? "日付を編集" : "日付を追加"}</h2>
        <form id="date-dialog-form" onSubmit={handleSubmit}>
          <label>
            日付
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </label>
          <label>
            金額（円）
            <input type="number" min="0" step="100" value={amount} onChange={(event) => setAmount(event.target.value)} />
          </label>
          {error && <span className="caption" style={{ color: "#e53935" }}>{error}</span>}
        </form>
        <div className="dialog-footer">
          {initialValue && onDelete && (
            <button type="button" className="danger" onClick={() => onDelete(initialValue.id)}>
              削除
            </button>
          )}
          <button type="button" className="secondary" onClick={onClose}>
            キャンセル
          </button>
          <button type="submit" className="primary" form="date-dialog-form">
            保存
          </button>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [data, setData] = useState(loadInitialState);
  const [memberDialog, setMemberDialog] = useState({ open: false, target: null });
  const [dateDialog, setDateDialog] = useState({ open: false, target: null });
  const [draggingMemberId, setDraggingMemberId] = useState(null);
  const [dragOverMemberId, setDragOverMemberId] = useState(null);
  const [importStatus, setImportStatus] = useState("");
  const [pullDistance, setPullDistance] = useState(0);
  const [pullReady, setPullReady] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [assetMetadata, setAssetMetadata] = useState([]);
  const fileInputRef = useRef(null);
  const pullStartYRef = useRef(0);
  const pullActiveRef = useRef(false);
  const thresholdReachedRef = useRef(false);
  const refreshingRef = useRef(false);

  useEffect(() => {
    const getScrollTop = () => {
      const doc = document.documentElement;
      const body = document.body;
      return Math.max(
        window.scrollY || 0,
        doc ? doc.scrollTop : 0,
        body ? body.scrollTop : 0
      );
    };

    const resetVisualState = () => {
      setPullDistance(0);
      setPullReady(false);
    };

    const triggerRefresh = () => {
      setPullReady(false);
      setIsRefreshing(true);
      setPullDistance(PULL_TO_REFRESH_INDICATOR_HEIGHT);
      refreshingRef.current = true;

      setTimeout(async () => {
        try {
          if ("serviceWorker" in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            await Promise.all(
              registrations.map((registration) => registration.update().catch(() => {}))
            );
          }
        } catch (error) {
          console.warn("Pull-to-refresh update failed", error);
        } finally {
          window.location.reload();
        }
      }, 150);
    };

    const handleTouchStart = (event) => {
      if (event.touches.length !== 1) {
        pullActiveRef.current = false;
        return;
      }
      if (getScrollTop() > 0 || refreshingRef.current) {
        pullActiveRef.current = false;
        return;
      }
      pullActiveRef.current = true;
      pullStartYRef.current = event.touches[0].clientY;
      thresholdReachedRef.current = false;
    };

    const handleTouchMove = (event) => {
      if (!pullActiveRef.current) {
        return;
      }
      const currentY = event.touches[0].clientY;
      const diff = currentY - pullStartYRef.current;
      if (diff <= 0) {
        thresholdReachedRef.current = false;
        resetVisualState();
        return;
      }

      const distance = Math.min(diff, PULL_TO_REFRESH_MAX_DISTANCE);
      setPullDistance(distance);

      const reached = distance >= PULL_TO_REFRESH_THRESHOLD;
      if (reached !== thresholdReachedRef.current) {
        thresholdReachedRef.current = reached;
        setPullReady(reached);
      }

      event.preventDefault();
    };

    const finishPull = (shouldRefresh) => {
      pullActiveRef.current = false;
      pullStartYRef.current = 0;

      if (shouldRefresh && !refreshingRef.current) {
        thresholdReachedRef.current = false;
        triggerRefresh();
        return;
      }

      thresholdReachedRef.current = false;
      resetVisualState();
    };

    const handleTouchEnd = () => {
      if (!pullActiveRef.current) {
        return;
      }
      finishPull(thresholdReachedRef.current);
    };

    const handleTouchCancel = () => {
      if (!pullActiveRef.current) {
        return;
      }
      finishPull(false);
    };

    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleTouchEnd);
    window.addEventListener("touchcancel", handleTouchCancel);

    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("touchcancel", handleTouchCancel);
    };
  }, []);
  useEffect(() => {
    const normalized = ensureAttendanceCompleteness(data);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(normalized));
  }, [data]);
  useEffect(() => {
    let cancelled = false;

    const fetchAssetMetadata = async () => {
      try {
        const entries = await Promise.all(
          ASSETS_TO_TRACK.map(async (asset) => {
            const result = { name: asset.name, timestamp: "" };
            try {
              const headResponse = await fetch(asset.url, { method: "HEAD", cache: "reload" });
              if (!headResponse.ok) {
                throw new Error(`HEAD request failed: ${headResponse.status}`);
              }
              const headerValue = headResponse.headers.get("Last-Modified");
              result.timestamp = formatAssetTimestamp(headerValue);
              return result;
            } catch (error) {
              try {
                const getResponse = await fetch(asset.url, { cache: "reload" });
                if (getResponse.ok) {
                  const headerValue = getResponse.headers.get("Last-Modified");
                  result.timestamp = formatAssetTimestamp(headerValue);
                  return result;
                }
              } catch (innerError) {
                console.warn("Asset metadata fetch failed", asset.url, innerError);
              }
              console.warn("Asset metadata HEAD request failed", asset.url, error);
              return result;
            }
          })
        );

        if (!cancelled) {
          setAssetMetadata(entries);
        }
      } catch (error) {
        console.warn("Asset metadata collection failed", error);
      }
    };

    fetchAssetMetadata();

    return () => {
      cancelled = true;
    };
  }, []);

  const sortedDates = useMemo(() => {
    return [...data.expenseDays].sort((a, b) => (a.date > b.date ? 1 : -1));
  }, [data.expenseDays]);

  const totals = useMemo(() => {
    const result = {};
    data.members.forEach((member) => {
      const memberAttendance = data.attendance[member.id] || {};
      const total = sortedDates.reduce((acc, day) => {
        return memberAttendance[day.id] ? acc + day.amount : acc;
      }, 0);
      result[member.id] = total;
    });
    return result;
  }, [data.members, data.attendance, sortedDates]);

  const openNewMemberDialog = () => setMemberDialog({ open: true, target: null });
  const openEditMemberDialog = (member) => setMemberDialog({ open: true, target: member });
  const openNewDateDialog = () => setDateDialog({ open: true, target: null });
  const openEditDateDialog = (day) => setDateDialog({ open: true, target: day });

  const handleDragStart = (memberId) => (event) => {
    setDraggingMemberId(memberId);
    setDragOverMemberId(null);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      try {
        event.dataTransfer.setData("text/plain", memberId);
      } catch (error) {
        // no-op: some browsers may throw in secure contexts
      }
    }
  };

  const handleDragOver = (memberId) => (event) => {
    event.preventDefault();
    if (memberId === draggingMemberId) {
      return;
    }
    setDragOverMemberId(memberId);
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "move";
    }
  };

  const handleDragLeave = (memberId) => () => {
    if (dragOverMemberId === memberId) {
      setDragOverMemberId(null);
    }
  };

  const handleDrop = (memberId) => (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!draggingMemberId || draggingMemberId === memberId) {
      return;
    }
    setData((prev) => {
      const members = reorderMembers(prev.members, draggingMemberId, memberId);
      if (members === prev.members) {
        return prev;
      }
      return { ...prev, members };
    });
    setDraggingMemberId(null);
    setDragOverMemberId(null);
  };

  const handleDropToEnd = (event) => {
    if (!draggingMemberId) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    setData((prev) => {
      const currentIndex = prev.members.findIndex((member) => member.id === draggingMemberId);
      if (currentIndex === -1 || currentIndex === prev.members.length - 1) {
        return prev;
      }
      const updated = [...prev.members];
      const [moved] = updated.splice(currentIndex, 1);
      updated.push(moved);
      return { ...prev, members: updated };
    });
    setDraggingMemberId(null);
    setDragOverMemberId(null);
  };

  const handleDragEnd = () => {
    setDraggingMemberId(null);
    setDragOverMemberId(null);
  };
  const closeMemberDialog = () => setMemberDialog({ open: false, target: null });
  const closeDateDialog = () => setDateDialog({ open: false, target: null });

  const upsertMember = (payload) => {
    setData((prev) => {
      if (payload.id) {
        const members = prev.members.map((member) =>
          member.id === payload.id ? { ...member, name: payload.name, className: payload.className } : member
        );
        return { ...prev, members };
      }
      const id = generateId("member");
      const newMember = { id, name: payload.name, className: payload.className };
      const attendance = { ...prev.attendance, [id]: {} };
      prev.expenseDays.forEach((day) => {
        attendance[id][day.id] = false;
      });
      return { ...prev, members: [...prev.members, newMember], attendance };
    });
    closeMemberDialog();
  };

  const removeMember = (memberId) => {
    if (!window.confirm("この部員を削除しますか？")) return;
    setData((prev) => {
      const members = prev.members.filter((member) => member.id !== memberId);
      const attendance = { ...prev.attendance };
      delete attendance[memberId];
      return { ...prev, members, attendance };
    });
    closeMemberDialog();
  };

  const upsertDate = (payload) => {
    setData((prev) => {
      if (payload.id) {
        const expenseDays = prev.expenseDays
          .map((day) => (day.id === payload.id ? { ...day, date: payload.date, amount: payload.amount } : day))
          .sort((a, b) => (a.date > b.date ? 1 : -1));
        return { ...prev, expenseDays };
      }
      const id = generateId("date");
      const newDay = { id, date: payload.date, amount: payload.amount };
      const expenseDays = [...prev.expenseDays, newDay].sort((a, b) => (a.date > b.date ? 1 : -1));
      const attendance = { ...prev.attendance };
      prev.members.forEach((member) => {
        const memberMap = { ...(attendance[member.id] || {}) };
        memberMap[id] = false;
        attendance[member.id] = memberMap;
      });
      return { ...prev, expenseDays, attendance };
    });
    closeDateDialog();
  };

  const removeDate = (dateId) => {
    if (!window.confirm("この日付を削除しますか？")) return;
    setData((prev) => {
      const expenseDays = prev.expenseDays.filter((day) => day.id !== dateId);
      const attendance = Object.fromEntries(
        Object.entries(prev.attendance).map(([memberId, record]) => {
          const updated = { ...record };
          delete updated[dateId];
          return [memberId, updated];
        })
      );
      return { ...prev, expenseDays, attendance };
    });
    closeDateDialog();
  };

  const toggleAttendance = (memberId, dateId) => {
    setData((prev) => {
      const attendance = { ...prev.attendance };
      const memberAttendance = { ...(attendance[memberId] || {}) };
      memberAttendance[dateId] = !memberAttendance[dateId];
      attendance[memberId] = memberAttendance;
      return { ...prev, attendance };
    });
  };

  const handleExport = () => {
    downloadJson(data);
  };

  const handleImport = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        const sanitized = validateImportedData(parsed);
        setData(sanitized);
        setImportStatus("データを読み込みました。");
      } catch (error) {
        console.error(error);
        setImportStatus(error.message || "読み込みに失敗しました。");
      } finally {
        event.target.value = "";
      }
    };
    reader.onerror = () => {
      setImportStatus("ファイルの読み込みに失敗しました。");
      event.target.value = "";
    };
    reader.readAsText(file, "utf-8");
  };

  const totalAmountAll = useMemo(() => {
    return data.members.reduce((acc, member) => acc + (totals[member.id] || 0), 0);
  }, [data.members, totals]);

  const totalFooterColspan = sortedDates.length + 2;

  const indicatorHeight = isRefreshing
    ? PULL_TO_REFRESH_INDICATOR_HEIGHT
    : Math.max(0, Math.min(pullDistance, PULL_TO_REFRESH_MAX_DISTANCE));
  const pullMessage = isRefreshing
    ? "\u66F4\u65B0\u3057\u3066\u3044\u307E\u3059..."
    : pullReady
    ? "\u624B\u3092\u96E2\u3057\u3066\u66F4\u65B0"
    : "\u4E0B\u306B\u5F15\u3063\u5F35\u308B\u3068\u66F4\u65B0\u3067\u304D\u307E\u3059";
  const pullClassName = [
    "pull-to-refresh",
    (pullDistance > 0 || isRefreshing) && "visible",
    pullReady && !isRefreshing && "ready",
    isRefreshing && "refreshing",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <main>
      <div className={pullClassName} style={{ height: `${indicatorHeight}px` }}>
        <span>{pullMessage}</span>
      </div>
      <header>
        <div>
          <h1>部活動経費マネージャー</h1>
          <p className="caption">部員ごとの参加状況を記録し、支払額を自動計算します。</p>
        </div>
        <div className="actions">
          <button className="primary" onClick={openNewMemberDialog}>
            部員を追加
          </button>
          <button className="primary" onClick={openNewDateDialog}>
            日付＆金額を追加
          </button>
        </div>
      </header>

      <section className="table-container">
        <table>
          <thead>
            <tr>
              <th>部員名</th>
              <th>クラス</th>
              {sortedDates.map((day) => (
                <th key={day.id}>
                  <div>{formatDateDisplay(day.date)}</div>
                  <div className="caption">{formatCurrency(day.amount)}</div>
                  <div className="toolbar">
                    <button className="link" draggable={false} onClick={() => openEditDateDialog(day)}>
                      編集
                    </button>
                  </div>
                </th>
              ))}
              <th>合計金額</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody
            onDragOver={(event) => {
              if (draggingMemberId) {
                event.preventDefault();
              }
            }}
            onDrop={handleDropToEnd}
          >
            {data.members.length === 0 ? (
              <tr>
                <td colSpan={sortedDates.length + 3} className="caption" style={{ textAlign: "center" }}>
                  部員が登録されていません。
                </td>
              </tr>
            ) : (
              data.members.map((member) => {
                const attendanceMap = data.attendance[member.id] || {};
                const isDragging = draggingMemberId === member.id;
                const isDragOver = dragOverMemberId === member.id && draggingMemberId !== member.id;
                const rowClassNames = ["member-row"];
                if (isDragging) {
                  rowClassNames.push("dragging");
                }
                if (isDragOver) {
                  rowClassNames.push("drag-over");
                }
                return (
                  <tr
                    key={member.id}
                    className={rowClassNames.join(" ")}
                    onDragOver={handleDragOver(member.id)}
                    onDragLeave={handleDragLeave(member.id)}
                    onDrop={handleDrop(member.id)}
                  >
                    <td
                      className="name-cell"
                      draggable
                      onDragStart={handleDragStart(member.id)}
                      onDragEnd={handleDragEnd}
                      aria-grabbed={isDragging}
                      aria-label={`${member.name} の表示順を変更`}
                    >
                      {member.name}
                    </td>
                    <td className="class-cell">{member.className}</td>
                    {sortedDates.map((day) => {
                      const isOn = Boolean(attendanceMap[day.id]);
                      return (
                        <td key={day.id} className="toggle-cell">
                          <button
                            className={isOn ? "on" : "off"}
                            draggable={false}
                            onClick={() => toggleAttendance(member.id, day.id)}
                            aria-pressed={isOn}
                          >
                            {isOn ? "出" : "欠"}
                          </button>
                        </td>
                      );
                    })}
                    <td className="total-cell">{formatCurrency(totals[member.id] || 0)}</td>
                    <td>
                      <div className="toolbar">
                        <button className="link" draggable={false} onClick={() => openEditMemberDialog(member)}>
                          編集
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={totalFooterColspan} style={{ textAlign: "right", fontWeight: 600 }}>
                合計
              </td>
              <td className="total-cell">{formatCurrency(totalAmountAll)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </section>

      <section className="backup-actions">
        <div className="backup-buttons">
          <button className="secondary" onClick={handleExport}>
            バックアップ
          </button>
          <button
            className="secondary"
            onClick={() => {
              setImportStatus("");
              fileInputRef.current?.click();
            }}
          >
            バックアップから復元
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            hidden
            onChange={handleImport}
          />
        </div>
        {importStatus && (
          <span
            className="caption"
            style={{ color: importStatus.includes("失敗") ? "#e53935" : "#388e3c" }}
          >
            {importStatus}
          </span>
        )}
      </section>

      <MemberDialog
        open={memberDialog.open}
        initialValue={memberDialog.target}
        onClose={closeMemberDialog}
        onSubmit={upsertMember}
        onDelete={(id) => removeMember(id)}
      />
      <DateDialog
        open={dateDialog.open}
        initialValue={dateDialog.target}
        onClose={closeDateDialog}
        onSubmit={upsertDate}
        onDelete={(id) => removeDate(id)}
      />
      <footer className="asset-meta">
        {assetMetadata.map(({ name, timestamp }) => (
          <span key={name}>
            {name}
            {" - "}
            {timestamp || "-"}
          </span>
        ))}
      </footer>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);

