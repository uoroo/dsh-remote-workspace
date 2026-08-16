window.__ModuleLoader__.load({
	id: "dsh-workspace-picker-plus",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_dom = require("react-dom");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region \0dsh-css:/home/vina/deepseek-harness/scratch-plugin/src/client/FileBrowser.module.css.mjs
		const css$2 = ".yHacoW_overlay{z-index:1000;background:#00000073;justify-content:center;align-items:center;display:flex;position:fixed;inset:0}.yHacoW_dialog{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);width:400px;max-width:calc(100vw - 32px);max-height:calc(100vh - 32px);box-shadow:0 8px 24px var(--dsw-alias-bg-mask-drop);font-family:var(--dsw-font-family);color:var(--dsw-alias-label-primary);border-radius:8px;flex-direction:column;gap:12px;padding:16px;display:flex}.yHacoW_title{margin:0;font-size:15px;font-weight:600}.yHacoW_path{text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-secondary);font-size:12px;overflow:hidden}.yHacoW_list{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);border-radius:6px;flex-direction:column;gap:2px;min-height:160px;max-height:320px;padding:4px;display:flex;overflow-y:auto}.yHacoW_newRow{gap:6px;display:flex}.yHacoW_newInput{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);min-width:0;color:var(--dsw-alias-label-primary);border-radius:6px;flex:1;padding:6px 8px;font-size:13px}.yHacoW_row{align-items:center;gap:4px;display:flex}.yHacoW_row:hover{background:var(--dsw-alias-interactive-bg-hover);border-radius:4px}.yHacoW_rowActions{gap:2px;margin-left:auto;padding-right:4px;display:none}.yHacoW_row:hover .yHacoW_rowActions{display:inline-flex}.yHacoW_miniButton{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-button-tool-bar-fill);color:var(--dsw-alias-label-secondary);cursor:pointer;border-radius:4px;padding:2px 6px;font-size:11px}.yHacoW_miniButton:hover{background:var(--dsw-alias-button-tool-bar-hover)}.yHacoW_entryButton{color:var(--dsw-alias-label-primary);text-align:left;cursor:pointer;background:0 0;border:none;border-radius:4px;padding:6px 8px;font-size:13px}.yHacoW_entryButton:hover{background:var(--dsw-alias-interactive-bg-hover)}.yHacoW_file{color:var(--dsw-alias-label-dimmed);padding:6px 8px;font-size:13px}.yHacoW_status{color:var(--dsw-alias-label-secondary);padding:6px 8px;font-size:13px}.yHacoW_actions{justify-content:flex-end;gap:8px;display:flex}.yHacoW_actionButton{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-button-tool-bar-fill);color:var(--dsw-alias-label-primary);cursor:pointer;border-radius:6px;padding:6px 14px;font-size:13px}.yHacoW_actionButton:hover:not(:disabled){background:var(--dsw-alias-button-tool-bar-hover)}.yHacoW_actionButton:disabled{cursor:not-allowed;opacity:.5}";
		const tagId$2 = "dsh-workspace-picker-plus/FileBrowser.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$2) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-workspace-picker-plus";
			tag.dataset.pluginCss = tagId$2;
			tag.textContent = css$2;
			document.head.appendChild(tag);
		}
		var FileBrowser_module_css_default = {
			"actionButton": "yHacoW_actionButton",
			"title": "yHacoW_title",
			"entryButton": "yHacoW_entryButton",
			"row": "yHacoW_row",
			"path": "yHacoW_path",
			"overlay": "yHacoW_overlay",
			"actions": "yHacoW_actions",
			"file": "yHacoW_file",
			"status": "yHacoW_status",
			"newInput": "yHacoW_newInput",
			"dialog": "yHacoW_dialog",
			"miniButton": "yHacoW_miniButton",
			"list": "yHacoW_list",
			"rowActions": "yHacoW_rowActions",
			"newRow": "yHacoW_newRow"
		};
		//#endregion
		//#region src/client/FileBrowser.tsx
		/**
		* In-app directory browser: lists the harness machine's filesystem through
		* the reverse-proxy API (`GET /api-fs/list?path=…`) and hands the current
		* directory back as the picked path. Supports creating, renaming and
		* deleting folders. Initial path defaults to the user's home (~).
		*/
		/** Join a child name onto a parent directory path ('~' expands server-side). */
		function joinPath$1(parent, name) {
			const base = parent === "" ? "~" : parent;
			return base === "/" ? `/${name}` : `${base}/${name}`;
		}
		/** Parent directory of an absolute path; the root stays the root. */
		function parentOf$1(path) {
			if (path === "" || path === "~" || path === "/") return "~";
			const trimmed = path.endsWith("/") ? path.slice(0, -1) : path;
			const cut = trimmed.lastIndexOf("/");
			return cut <= 0 ? "/" : trimmed.slice(0, cut);
		}
		/** Extract a displayable failure message from a rejected promise. */
		function failureMessage$3(reason) {
			return reason instanceof Error ? reason.message : String(reason);
		}
		/**
		* Render the directory browser: header path, entry list (directories
		* navigable, with rename/delete actions), folder creation, and the
		* commit/navigation actions.
		*/
		function FileBrowser(props) {
			const { busy, initialPath, onPicked, onBack, onCancel, onError } = props;
			const [path, setPath] = (0, react.useState)(initialPath && initialPath !== "" ? initialPath : "~");
			const [entries, setEntries] = (0, react.useState)([]);
			const [loading, setLoading] = (0, react.useState)(true);
			const [newName, setNewName] = (0, react.useState)("");
			const [creating, setCreating] = (0, react.useState)(false);
			/** Reload the current directory listing. */
			const reload = () => {
				setLoading(true);
				fetch(`/api-fs/list?path=${encodeURIComponent(path)}`).then(async (response) => {
					if (!response.ok) throw new Error(`HTTP ${response.status}`);
					const data = await response.json();
					if (typeof data !== "object" || data === null || !Array.isArray(data.entries)) throw new Error("响应格式错误");
					return data;
				}).then((data) => {
					const record = data;
					if (typeof record.path === "string" && record.path !== "") setPath(record.path);
					setEntries(record.entries.map((item) => {
						const entry = item;
						return {
							name: String(entry.name ?? ""),
							isDir: entry.isDir === true
						};
					}));
					setLoading(false);
				}, (reason) => {
					setLoading(false);
					onError(`无法读取目录：${failureMessage$3(reason)}`);
				});
			};
			(0, react.useEffect)(reload, [path]);
			/** Create a folder under the current directory, then reload. */
			const createFolder = () => {
				const name = newName.trim();
				if (!name) return;
				setCreating(true);
				fetch("/api-fs/mkdir", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ path: joinPath$1(path, name) })
				}).then(async (response) => {
					const data = await response.json();
					if (!response.ok || data.ok !== true) throw new Error(data.error || `HTTP ${response.status}`);
					setNewName("");
					reload();
				}, (reason) => onError(`新建失败：${failureMessage$3(reason)}`)).finally(() => setCreating(false));
			};
			/** Rename a folder entry. */
			const renameFolder = (name) => {
				const newValue = window.prompt("重命名文件夹", name);
				if (newValue === null) return;
				const trimmed = newValue.trim();
				if (!trimmed || trimmed === name) return;
				fetch("/api-fs/rename", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						path: joinPath$1(path, name),
						newName: trimmed
					})
				}).then(async (response) => {
					const data = await response.json();
					if (!response.ok || data.ok !== true) throw new Error(data.error || `HTTP ${response.status}`);
					reload();
				}, (reason) => onError(`重命名失败：${failureMessage$3(reason)}`));
			};
			/** Delete a folder entry (empty folders only, server-enforced). */
			const deleteFolder = (name) => {
				if (!window.confirm(`确定删除文件夹「${name}」？（仅空目录可删除）`)) return;
				fetch("/api-fs/delete", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ path: joinPath$1(path, name) })
				}).then(async (response) => {
					const data = await response.json();
					if (!response.ok || data.ok !== true) throw new Error(data.error || `HTTP ${response.status}`);
					reload();
				}, (reason) => onError(`删除失败：${failureMessage$3(reason)}`));
			};
			return (0, react_dom.createPortal)(/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: FileBrowser_module_css_default.overlay,
				onClick: onCancel,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					role: "dialog",
					"aria-label": "Web 文件管理器",
					className: FileBrowser_module_css_default.dialog,
					onClick: (event) => event.stopPropagation(),
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
							className: FileBrowser_module_css_default.title,
							children: "Web 文件管理器"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: FileBrowser_module_css_default.path,
							title: path,
							children: path
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: FileBrowser_module_css_default.newRow,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								className: FileBrowser_module_css_default.newInput,
								placeholder: "新文件夹名称",
								value: newName,
								onChange: (event) => setNewName(event.target.value),
								onKeyDown: (event) => {
									if (event.key === "Enter") createFolder();
								}
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: FileBrowser_module_css_default.actionButton,
								disabled: creating || !newName.trim(),
								onClick: createFolder,
								children: "新建文件夹"
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: FileBrowser_module_css_default.list,
							children: loading ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: FileBrowser_module_css_default.status,
								role: "status",
								children: "加载中…"
							}) : entries.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: FileBrowser_module_css_default.status,
								children: "（空目录）"
							}) : entries.map((entry) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: FileBrowser_module_css_default.row,
								children: [entry.isDir ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: FileBrowser_module_css_default.entryButton,
									onClick: () => setPath(joinPath$1(path, entry.name)),
									children: entry.name
								}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: FileBrowser_module_css_default.file,
									children: entry.name
								}), entry.isDir && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: FileBrowser_module_css_default.rowActions,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: FileBrowser_module_css_default.miniButton,
										onClick: () => renameFolder(entry.name),
										children: "重命名"
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: FileBrowser_module_css_default.miniButton,
										onClick: () => deleteFolder(entry.name),
										children: "删除"
									})]
								})]
							}, entry.name))
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: FileBrowser_module_css_default.actions,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: FileBrowser_module_css_default.actionButton,
									disabled: path === "/" || path === "~" || loading,
									onClick: () => setPath(parentOf$1(path)),
									children: "上级目录"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: FileBrowser_module_css_default.actionButton,
									disabled: busy || loading,
									onClick: () => onPicked(path === "~" ? "" : path),
									children: "选择此目录"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: FileBrowser_module_css_default.actionButton,
									onClick: onBack,
									children: "返回"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: FileBrowser_module_css_default.actionButton,
									onClick: onCancel,
									children: "取消"
								})
							]
						})
					]
				})
			}), document.body);
		}
		//#endregion
		//#region \0dsh-css:/home/vina/deepseek-harness/scratch-plugin/src/client/SshfsForm.module.css.mjs
		const css$1 = ".iRxq0q_overlay{z-index:1000;background:#00000073;justify-content:center;align-items:center;display:flex;position:fixed;inset:0}.iRxq0q_dialog{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);width:400px;max-width:calc(100vw - 32px);box-shadow:0 8px 24px var(--dsw-alias-bg-mask-drop);font-family:var(--dsw-font-family);color:var(--dsw-alias-label-primary);border-radius:8px;flex-direction:column;gap:12px;padding:16px;display:flex}.iRxq0q_title{margin:0;font-size:15px;font-weight:600}.iRxq0q_form{flex-direction:column;gap:10px;display:flex}.iRxq0q_field{flex-direction:column;gap:4px;display:flex}.iRxq0q_fieldWithButton{align-items:flex-end;gap:6px;display:flex}.iRxq0q_fieldWithButton .iRxq0q_field{flex:1;min-width:0}.iRxq0q_selectButton{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-button-tool-bar-fill);color:var(--dsw-alias-label-primary);cursor:pointer;white-space:nowrap;border-radius:6px;padding:6px 12px;font-size:13px}.iRxq0q_selectButton:hover:not(:disabled){background:var(--dsw-alias-button-tool-bar-hover)}.iRxq0q_selectButton:disabled{cursor:not-allowed;opacity:.5}.iRxq0q_label{color:var(--dsw-alias-label-secondary);font-size:12px}.iRxq0q_input{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);border-radius:6px;padding:6px 8px;font-size:13px}.iRxq0q_radios{gap:16px;display:flex}.iRxq0q_radio{align-items:center;gap:4px;font-size:13px;display:flex}.iRxq0q_error{background:var(--dsw-alias-state-error-secondary);color:var(--dsw-alias-state-error-primary);border-radius:4px;padding:6px 8px;font-size:12px}.iRxq0q_actions{justify-content:flex-end;gap:8px;display:flex}.iRxq0q_actionButton{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-button-tool-bar-fill);color:var(--dsw-alias-label-primary);cursor:pointer;border-radius:6px;padding:6px 14px;font-size:13px}.iRxq0q_actionButton:hover:not(:disabled){background:var(--dsw-alias-button-tool-bar-hover)}.iRxq0q_actionButton:disabled{cursor:not-allowed;opacity:.5}";
		const tagId$1 = "dsh-workspace-picker-plus/SshfsForm.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$1) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-workspace-picker-plus";
			tag.dataset.pluginCss = tagId$1;
			tag.textContent = css$1;
			document.head.appendChild(tag);
		}
		var SshfsForm_module_css_default = {
			"error": "iRxq0q_error",
			"radios": "iRxq0q_radios",
			"actions": "iRxq0q_actions",
			"dialog": "iRxq0q_dialog",
			"field": "iRxq0q_field",
			"selectButton": "iRxq0q_selectButton",
			"label": "iRxq0q_label",
			"overlay": "iRxq0q_overlay",
			"form": "iRxq0q_form",
			"title": "iRxq0q_title",
			"fieldWithButton": "iRxq0q_fieldWithButton",
			"input": "iRxq0q_input",
			"radio": "iRxq0q_radio",
			"actionButton": "iRxq0q_actionButton"
		};
		//#endregion
		//#region src/client/RemoteBrowser.tsx
		/**
		* Remote directory browser: lists a remote host's filesystem through the
		* reverse-proxy sftp API (`/api-fs/remote-*`) and hands the current
		* directory back as the picked path. Supports creating, renaming and
		* deleting folders. Initial path follows the SSH login directory (or an
		* explicit initialPath).
		*/
		/** POST a remote /api-fs RPC and decode its JSON. */
		function remoteRpc(method, body) {
			return fetch(method, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body)
			}).then(async (response) => response.json());
		}
		/** Join a child name onto a remote directory path. */
		function joinPath(parent, name) {
			return parent === "/" ? `/${name}` : `${parent}/${name}`;
		}
		/** Parent directory of a remote path; the root stays the root. */
		function parentOf(path) {
			if (path === "/") return "/";
			const trimmed = path.endsWith("/") ? path.slice(0, -1) : path;
			const cut = trimmed.lastIndexOf("/");
			return cut <= 0 ? "/" : trimmed.slice(0, cut);
		}
		/** Extract a displayable failure message from a rejected promise. */
		function failureMessage$2(reason) {
			return reason instanceof Error ? reason.message : String(reason);
		}
		/**
		* Render the remote directory browser: header path, entry list with
		* rename/delete actions, folder creation, and the commit/navigation actions.
		*/
		function RemoteBrowser(props) {
			const { host, user, auth, busy, initialPath, onPicked, onBack, onCancel, onError } = props;
			const [path, setPath] = (0, react.useState)("");
			const [entries, setEntries] = (0, react.useState)([]);
			const [loading, setLoading] = (0, react.useState)(true);
			const [newName, setNewName] = (0, react.useState)("");
			const [creating, setCreating] = (0, react.useState)(false);
			const session = {
				host,
				user,
				auth
			};
			/** Reload the given remote directory. */
			const reload = (current) => {
				setLoading(true);
				remoteRpc("/api-fs/remote-list", {
					...session,
					path: current
				}).then((data) => {
					if (data.error) throw new Error(data.error);
					if (typeof data.path === "string" && data.path !== "") setPath(data.path);
					setEntries(data.entries ?? []);
					setLoading(false);
				}, (reason) => {
					setLoading(false);
					onError(`无法读取远程目录：${failureMessage$2(reason)}`);
				});
			};
			(0, react.useEffect)(() => {
				if (path === "") {
					if (initialPath && initialPath !== "") {
						setPath(initialPath);
						return;
					}
					remoteRpc("/api-fs/remote-pwd", session).then((data) => setPath(data.path || "."), () => setPath("."));
					return;
				}
				reload(path);
			}, [path]);
			/** Create a folder under the current directory, then reload. */
			const createFolder = () => {
				const name = newName.trim();
				if (!name) return;
				setCreating(true);
				remoteRpc("/api-fs/remote-mkdir", {
					...session,
					path: joinPath(path, name)
				}).then((data) => {
					if (data.ok !== true) throw new Error(data.error || "新建失败");
					setNewName("");
					reload(path);
				}, (reason) => onError(`新建失败：${failureMessage$2(reason)}`)).finally(() => setCreating(false));
			};
			/** Rename a folder entry. */
			const renameFolder = (name) => {
				const newValue = window.prompt("重命名远程文件夹", name);
				if (newValue === null) return;
				const trimmed = newValue.trim();
				if (!trimmed || trimmed === name) return;
				remoteRpc("/api-fs/remote-rename", {
					...session,
					path: joinPath(path, name),
					newName: trimmed
				}).then((data) => {
					if (data.ok !== true) throw new Error(data.error || "重命名失败");
					reload(path);
				}, (reason) => onError(`重命名失败：${failureMessage$2(reason)}`));
			};
			/** Delete a folder entry (empty folders only, server-enforced). */
			const deleteFolder = (name) => {
				if (!window.confirm(`确定删除远程文件夹「${name}」？（仅空目录可删除）`)) return;
				remoteRpc("/api-fs/remote-delete", {
					...session,
					path: joinPath(path, name)
				}).then((data) => {
					if (data.ok !== true) throw new Error(data.error || "删除失败");
					reload(path);
				}, (reason) => onError(`删除失败：${failureMessage$2(reason)}`));
			};
			return (0, react_dom.createPortal)(/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: FileBrowser_module_css_default.overlay,
				onClick: onCancel,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					role: "dialog",
					"aria-label": "远程目录选择",
					className: FileBrowser_module_css_default.dialog,
					onClick: (event) => event.stopPropagation(),
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("h2", {
							className: FileBrowser_module_css_default.title,
							children: [
								"远程目录选择（",
								host,
								"）"
							]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: FileBrowser_module_css_default.path,
							title: path,
							children: path || "（获取登录路径中…）"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: FileBrowser_module_css_default.newRow,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								className: FileBrowser_module_css_default.newInput,
								placeholder: "新文件夹名称",
								value: newName,
								onChange: (event) => setNewName(event.target.value),
								onKeyDown: (event) => {
									if (event.key === "Enter") createFolder();
								}
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: FileBrowser_module_css_default.actionButton,
								disabled: creating || !newName.trim(),
								onClick: createFolder,
								children: "新建文件夹"
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: FileBrowser_module_css_default.list,
							children: loading ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: FileBrowser_module_css_default.status,
								role: "status",
								children: "加载中…"
							}) : entries.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: FileBrowser_module_css_default.status,
								children: "（空目录）"
							}) : entries.map((entry) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: FileBrowser_module_css_default.row,
								children: [entry.isDir ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: FileBrowser_module_css_default.entryButton,
									onClick: () => setPath(joinPath(path, entry.name)),
									children: entry.name
								}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: FileBrowser_module_css_default.file,
									children: entry.name
								}), entry.isDir && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: FileBrowser_module_css_default.rowActions,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: FileBrowser_module_css_default.miniButton,
										onClick: () => renameFolder(entry.name),
										children: "重命名"
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: FileBrowser_module_css_default.miniButton,
										onClick: () => deleteFolder(entry.name),
										children: "删除"
									})]
								})]
							}, entry.name))
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: FileBrowser_module_css_default.actions,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: FileBrowser_module_css_default.actionButton,
									disabled: path === "/" || loading,
									onClick: () => setPath(parentOf(path)),
									children: "上级目录"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: FileBrowser_module_css_default.actionButton,
									disabled: busy || loading,
									onClick: () => onPicked(path),
									children: "选择此目录"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: FileBrowser_module_css_default.actionButton,
									onClick: onBack,
									children: "返回"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: FileBrowser_module_css_default.actionButton,
									onClick: onCancel,
									children: "取消"
								})
							]
						})
					]
				})
			}), document.body);
		}
		//#endregion
		//#region src/client/SshfsForm.tsx
		/**
		* Sshfs mount form: mounts a remote directory through the reverse-proxy API
		* (`POST /api-fs/sshfs-mount`) and hands the resulting mount point back as the
		* picked path. A server-side rejection stays inline so the operator can fix
		* credentials; transport failures go to the owner's error surface.
		*
		* Enhancements: a saved-SSH-config selector at the top (discovered from every
		* local user's ~/.ssh/config), and "选择" buttons beside the mount point and
		* remote path that open in-app directory browsers (local FileBrowser for the
		* mount point, RemoteBrowser over sftp for the remote path).
		*/
		/** Extract a displayable failure message from a rejected promise. */
		function failureMessage$1(reason) {
			return reason instanceof Error ? reason.message : String(reason);
		}
		/**
		* Render the mount form: saved-SSH-config selector, host/user/authentication,
		* remote path and mount point (each with a "选择" directory picker), plus the
		* commit/navigation actions.
		*/
		function SshfsForm(props) {
			const { busy, onPicked, onBack, onCancel, onError } = props;
			const [sshConfigs, setSshConfigs] = (0, react.useState)([]);
			const [selectedConfig, setSelectedConfig] = (0, react.useState)("");
			const [host, setHost] = (0, react.useState)("");
			const [user, setUser] = (0, react.useState)("");
			const [auth, setAuth] = (0, react.useState)("password");
			const [password, setPassword] = (0, react.useState)("");
			const [keyPath, setKeyPath] = (0, react.useState)("");
			const [remotePath, setRemotePath] = (0, react.useState)("");
			const [mountPoint, setMountPoint] = (0, react.useState)("");
			const [submitting, setSubmitting] = (0, react.useState)(false);
			const [inlineError, setInlineError] = (0, react.useState)(null);
			const [subView, setSubView] = (0, react.useState)(null);
			/** Load every local user's saved SSH configs for the selector. */
			(0, react.useEffect)(() => {
				fetch("/api-fs/ssh-configs").then(async (response) => response.json()).then((data) => {
					if (Array.isArray(data.configs)) setSshConfigs(data.configs);
				}, () => {});
			}, []);
			/** Fill the form from a picked saved SSH config. */
			const applyConfig = (hostName) => {
				setSelectedConfig(hostName);
				const cfg = sshConfigs.find((c) => c.host === hostName);
				if (!cfg) return;
				setHost(cfg.host);
				if (cfg.user) setUser(cfg.user);
				if (cfg.identityFile) {
					setAuth("key");
					setKeyPath(cfg.identityFile);
				} else setAuth("password");
			};
			/** POST the mount request; adopt the mount point or keep the form for retry. */
			const submit = (event) => {
				event.preventDefault();
				if (auth === "password" ? !host || !user || !password || !remotePath || !mountPoint : !host || !user || !keyPath || !remotePath || !mountPoint) {
					setInlineError("请填写所有必填字段");
					return;
				}
				setSubmitting(true);
				setInlineError(null);
				const body = JSON.stringify({
					host,
					user,
					auth: auth === "password" ? {
						type: "password",
						password
					} : {
						type: "key",
						keyPath
					},
					remotePath,
					mountPoint
				});
				fetch("/api-fs/sshfs-mount", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body
				}).then(async (response) => {
					if (!response.ok) throw new Error(`HTTP ${response.status}`);
					return response.json();
				}).then((data) => {
					setSubmitting(false);
					if (typeof data !== "object" || data === null) {
						setInlineError("挂载失败：未知错误");
						return;
					}
					const record = data;
					if (record.ok === true) {
						if (typeof record.mountPoint !== "string" || record.mountPoint === "") {
							setInlineError("挂载失败：响应缺少挂载点");
							return;
						}
						onPicked(record.mountPoint);
						return;
					}
					setInlineError(`挂载失败：${typeof record.error === "string" && record.error !== "" ? record.error : "未知错误"}`);
				}, (reason) => {
					setSubmitting(false);
					onError(`挂载请求失败：${failureMessage$1(reason)}`);
				});
			};
			if (subView === "mountPicker") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(FileBrowser, {
				busy,
				initialPath: "~",
				onPicked: (path) => {
					setMountPoint(path);
					setSubView(null);
				},
				onBack: () => setSubView(null),
				onCancel,
				onError
			});
			if (subView === "remoteBrowser") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(RemoteBrowser, {
				host,
				user,
				auth: {
					type: auth,
					password,
					keyPath
				},
				busy,
				onPicked: (path) => {
					setRemotePath(path);
					setSubView(null);
				},
				onBack: () => setSubView(null),
				onCancel,
				onError
			});
			return (0, react_dom.createPortal)(/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: SshfsForm_module_css_default.overlay,
				onClick: onCancel,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					role: "dialog",
					"aria-label": "SSHFS 挂载远程文件夹",
					className: SshfsForm_module_css_default.dialog,
					onClick: (event) => event.stopPropagation(),
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
							className: SshfsForm_module_css_default.title,
							children: "SSHFS 挂载远程文件夹"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: SshfsForm_module_css_default.field,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
								className: SshfsForm_module_css_default.label,
								htmlFor: "sshfs-config",
								children: "已保存的 SSH 配置"
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
								id: "sshfs-config",
								className: SshfsForm_module_css_default.input,
								value: selectedConfig,
								onChange: (event) => applyConfig(event.target.value),
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
									value: "",
									children: "手动输入"
								}), sshConfigs.map((cfg) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("option", {
									value: cfg.host,
									children: [
										cfg.host,
										cfg.hostname ? ` → ${cfg.hostname}` : "",
										"（",
										cfg.user || cfg.sourceUser,
										"）"
									]
								}, `${cfg.sourceUser}/${cfg.host}`))]
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("form", {
							className: SshfsForm_module_css_default.form,
							onSubmit: submit,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: SshfsForm_module_css_default.field,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
										className: SshfsForm_module_css_default.label,
										htmlFor: "sshfs-host",
										children: "主机"
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										id: "sshfs-host",
										className: SshfsForm_module_css_default.input,
										value: host,
										onChange: (event) => setHost(event.target.value)
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: SshfsForm_module_css_default.field,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
										className: SshfsForm_module_css_default.label,
										htmlFor: "sshfs-user",
										children: "用户名"
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										id: "sshfs-user",
										className: SshfsForm_module_css_default.input,
										value: user,
										onChange: (event) => setUser(event.target.value)
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: SshfsForm_module_css_default.field,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: SshfsForm_module_css_default.label,
										children: "认证方式"
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: SshfsForm_module_css_default.radios,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
											className: SshfsForm_module_css_default.radio,
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
												type: "radio",
												name: "sshfs-auth",
												checked: auth === "password",
												onChange: () => setAuth("password")
											}), "密码认证"]
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
											className: SshfsForm_module_css_default.radio,
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
												type: "radio",
												name: "sshfs-auth",
												checked: auth === "key",
												onChange: () => setAuth("key")
											}), "密钥认证"]
										})]
									})]
								}),
								auth === "password" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: SshfsForm_module_css_default.field,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
										className: SshfsForm_module_css_default.label,
										htmlFor: "sshfs-password",
										children: "密码"
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										id: "sshfs-password",
										className: SshfsForm_module_css_default.input,
										type: "password",
										value: password,
										onChange: (event) => setPassword(event.target.value)
									})]
								}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: SshfsForm_module_css_default.field,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
										className: SshfsForm_module_css_default.label,
										htmlFor: "sshfs-key-path",
										children: "密钥文件路径"
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										id: "sshfs-key-path",
										className: SshfsForm_module_css_default.input,
										value: keyPath,
										onChange: (event) => setKeyPath(event.target.value)
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: SshfsForm_module_css_default.fieldWithButton,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: SshfsForm_module_css_default.field,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
											className: SshfsForm_module_css_default.label,
											htmlFor: "sshfs-remote-path",
											children: "远程路径"
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
											id: "sshfs-remote-path",
											className: SshfsForm_module_css_default.input,
											value: remotePath,
											onChange: (event) => setRemotePath(event.target.value)
										})]
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: SshfsForm_module_css_default.selectButton,
										disabled: !host || !user,
										onClick: () => setSubView("remoteBrowser"),
										title: "打开远程目录选择器",
										children: "选择"
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: SshfsForm_module_css_default.fieldWithButton,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: SshfsForm_module_css_default.field,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
											className: SshfsForm_module_css_default.label,
											htmlFor: "sshfs-mount-point",
											children: "挂载点"
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
											id: "sshfs-mount-point",
											className: SshfsForm_module_css_default.input,
											value: mountPoint,
											onChange: (event) => setMountPoint(event.target.value)
										})]
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: SshfsForm_module_css_default.selectButton,
										onClick: () => setSubView("mountPicker"),
										title: "打开本机目录选择器",
										children: "选择"
									})]
								}),
								inlineError !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: SshfsForm_module_css_default.error,
									role: "alert",
									children: inlineError
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: SshfsForm_module_css_default.actions,
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "submit",
											className: SshfsForm_module_css_default.actionButton,
											disabled: busy || submitting,
											children: "挂载并选择"
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: SshfsForm_module_css_default.actionButton,
											onClick: onBack,
											children: "返回"
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: SshfsForm_module_css_default.actionButton,
											onClick: onCancel,
											children: "取消"
										})
									]
								})
							]
						})
					]
				})
			}), document.body);
		}
		//#endregion
		//#region \0dsh-css:/home/vina/deepseek-harness/scratch-plugin/src/client/PickerFlow.module.css.mjs
		const css = ".UZmMrq_overlay{z-index:1000;background:#00000073;justify-content:center;align-items:center;display:flex;position:fixed;inset:0}.UZmMrq_dialog{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);width:360px;max-width:calc(100vw - 32px);max-height:calc(100vh - 32px);box-shadow:0 8px 24px var(--dsw-alias-bg-mask-drop);font-family:var(--dsw-font-family);color:var(--dsw-alias-label-primary);border-radius:8px;flex-direction:column;gap:12px;padding:16px;display:flex}.UZmMrq_title{margin:0;font-size:15px;font-weight:600}.UZmMrq_options{flex-direction:column;gap:8px;display:flex}.UZmMrq_option{flex-direction:column;gap:4px;display:flex}.UZmMrq_optionButton{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-button-tool-bar-fill);width:100%;color:var(--dsw-alias-label-primary);text-align:left;cursor:pointer;border-radius:6px;padding:8px 12px;font-size:13px}.UZmMrq_optionButton:hover:not(:disabled){background:var(--dsw-alias-button-tool-bar-hover)}.UZmMrq_optionButton:disabled{cursor:not-allowed;opacity:.5}.UZmMrq_optionHint{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:16px}.UZmMrq_actions{justify-content:flex-end;gap:8px;display:flex}.UZmMrq_actionButton{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-button-tool-bar-fill);color:var(--dsw-alias-label-primary);cursor:pointer;border-radius:6px;padding:6px 14px;font-size:13px}.UZmMrq_actionButton:hover{background:var(--dsw-alias-button-tool-bar-hover)}";
		const tagId = "dsh-workspace-picker-plus/PickerFlow.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-workspace-picker-plus";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var PickerFlow_module_css_default = {
			"dialog": "UZmMrq_dialog",
			"option": "UZmMrq_option",
			"title": "UZmMrq_title",
			"actionButton": "UZmMrq_actionButton",
			"optionHint": "UZmMrq_optionHint",
			"options": "UZmMrq_options",
			"optionButton": "UZmMrq_optionButton",
			"overlay": "UZmMrq_overlay",
			"actions": "UZmMrq_actions"
		};
		//#endregion
		//#region src/client/PickerFlow.tsx
		/**
		* The three-choice picking occupant (package-internal; the `./client` surface
		* exposes only the Loader exports). Same-package tests exercise it directly
		* through this module.
		*/
		/**
		* The page is operated from the harness machine itself, so the native OS
		* chooser pops where the operator can see it.
		* @param hostname - `window.location.hostname` (already lowercased by URL parsing).
		* @returns true for localhost, any 127.* address, and both IPv6 loopback spellings.
		*/
		function isLoopbackHostname(hostname) {
			const lower = hostname.toLowerCase();
			return lower === "localhost" || lower.startsWith("127.") || lower === "::1" || lower === "[::1]";
		}
		/** Extract a displayable failure message from a rejected promise. */
		function failureMessage(reason) {
			return reason instanceof Error ? reason.message : String(reason);
		}
		/**
		* Directory-flow occupant: on a loopback host each rising `open` edge runs
		* exactly one native pick (renderless, same armed/alive ref contract as the
		* plain native flow); remote hosts get the three-choice dialog instead. The
		* owner withdrawing `open` closes any sub-view and re-arms the next request.
		* @param props - owner conversation plus the injected pick call.
		* @returns nothing on loopback/closed; otherwise the choice dialog or a sub-view.
		*/
		function PickerFlow(props) {
			const { open, busy, onPicked, onCancel, onError, pick } = props;
			const [mode, setMode] = (0, react.useState)("idle");
			const [picking, setPicking] = (0, react.useState)(false);
			const armed = (0, react.useRef)(false);
			const outcome = (0, react.useRef)(props);
			outcome.current = props;
			const alive = (0, react.useRef)(true);
			(0, react.useEffect)(() => {
				alive.current = true;
				return () => {
					alive.current = false;
				};
			}, []);
			/** Run one native pick and report its single outcome. */
			const runPick = () => {
				setPicking(true);
				pick().then((path) => {
					if (!alive.current) return;
					setPicking(false);
					if (path === null) outcome.current.onCancel();
					else outcome.current.onPicked(path);
				}, (reason) => {
					if (!alive.current) return;
					setPicking(false);
					outcome.current.onError(failureMessage(reason));
				});
			};
			(0, react.useEffect)(() => {
				if (!open) {
					armed.current = false;
					setMode("idle");
					return;
				}
				if (armed.current) return;
				armed.current = true;
				if (isLoopbackHostname(window.location.hostname)) runPick();
				else setMode("chooser");
			}, [open]);
			if (!open || mode === "idle") return null;
			if (mode === "browser") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(FileBrowser, {
				busy,
				onPicked,
				onBack: () => setMode("chooser"),
				onCancel,
				onError
			});
			if (mode === "sshfs") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SshfsForm, {
				busy,
				onPicked,
				onBack: () => setMode("chooser"),
				onCancel,
				onError
			});
			return (0, react_dom.createPortal)(/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: PickerFlow_module_css_default.overlay,
				onClick: onCancel,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					role: "dialog",
					"aria-label": "选择添加工作区方式",
					className: PickerFlow_module_css_default.dialog,
					onClick: (event) => event.stopPropagation(),
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
							className: PickerFlow_module_css_default.title,
							children: "选择添加工作区方式"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: PickerFlow_module_css_default.options,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: PickerFlow_module_css_default.option,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: PickerFlow_module_css_default.optionButton,
										disabled: busy || picking,
										onClick: runPick,
										children: "原生浏览器弹窗"
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: PickerFlow_module_css_default.optionHint,
										children: "将在本机（Lenovo）弹出系统文件夹选择器，远程设备操作需远程桌面"
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: PickerFlow_module_css_default.option,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: PickerFlow_module_css_default.optionButton,
										onClick: () => setMode("browser"),
										children: "Web 文件管理器"
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: PickerFlow_module_css_default.optionHint,
										children: "在当前页面浏览本机文件系统"
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: PickerFlow_module_css_default.option,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: PickerFlow_module_css_default.optionButton,
										onClick: () => setMode("sshfs"),
										children: "SSHFS 挂载远程文件夹"
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: PickerFlow_module_css_default.optionHint,
										children: "挂载远程服务器文件夹并选择挂载点"
									})]
								})
							]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: PickerFlow_module_css_default.actions,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: PickerFlow_module_css_default.actionButton,
								onClick: onCancel,
								children: "取消"
							})
						})
					]
				})
			}), document.body);
		}
		//#endregion
		//#region src/client/index.ts
		/** Required services (cordis fiber inject): the slot registry and the wire-facing workspace service. */
		const inject = ["slots", "workspaces"];
		/**
		* Client plugin body: register the three-choice flow into both
		* directory-flow holes through `slots.inject()` because the ui-workspace
		* entries may activate later or replace their declarations.
		* @param ctx - client root context.
		*/
		function apply(ctx) {
			const injected = () => ({ pick: () => ctx.workspaces.pickDirectory() });
			ctx.slots.inject("conversation.hero.workspace.directoryFlow", () => ctx.slots.inject("sidebar.workspaces.directoryFlow", function* () {
				yield ctx.slots.register({
					name: "conversation.hero.workspace.directoryFlow",
					inject: injected,
					priority: -200
				}, PickerFlow);
				yield ctx.slots.register({
					name: "sidebar.workspaces.directoryFlow",
					inject: injected,
					priority: -200
				}, PickerFlow);
			}));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map