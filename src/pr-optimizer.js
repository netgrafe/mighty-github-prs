(() => {
	const SELECTOR_FILE_HEADERS = '.file-header[data-anchor^="diff-"]';

	const CLASS_ACTIVE 		= 'mighty-viewer-active';
	const CLASS_FULL_WIDTH 	= 'full-width';
	const CLASS_COLLAPSED   = 'mighty-tree-collapsed'

	const ID_ACTION_BUTTON_CONTAINER 	= 'mighty-action-buttons';
	const ID_NEEDS_WORK_BUTTON 			= 'mighty-needs-work-button';
	const ID_APPROVE_BUTTON				= 'mighty-approve-button';
	const ID_TOGGLE_FILE_TREE_BUTTON	= 'mighty-toggle-file-tree-button'
	const ID_TOGGLE_ALL_DIFF			= 'mighty-toggle-all-diff'

	const ID_FILE_SELECTOR 				= 'mighty-file-selector'

	const state = {
		isFileTreeFullyRendered: false
	};

	let observer;

	function destroyMightyDiffViewer() {
		if (document.body.classList.contains(CLASS_ACTIVE)) {
			document.body.classList.remove(CLASS_ACTIVE);
			document.body.classList.remove(CLASS_FULL_WIDTH);
			document.body.classList.remove(CLASS_COLLAPSED);
		}

		const fileSelector = document.getElementById(ID_FILE_SELECTOR)

		if (fileSelector) {
			fileSelector.remove()
		}

		const buttonContainer = document.getElementById(ID_ACTION_BUTTON_CONTAINER);

		if (buttonContainer) {
			buttonContainer.remove();
		}

		state.isFileTreeFullyRendered = false;
	}

	// this function is building up a tree exactly based on the file path
	// this method has side effects on the parameters
	function addToTree(root, parts, fullFileDetails) {
		const nextPart = parts.shift();

		// if after shifting, the parts array is empty, we're at a leaf node
		if (parts.length === 0) {
			// it's a file
			if (root.FILES) {
				root.FILES.push(fullFileDetails)
			} else {
				root.FILES = [ fullFileDetails ];
			}
		} else {
			root[nextPart] = root[nextPart] || {};

			// shift already moved the first element
			addToTree(root[nextPart], parts, fullFileDetails);
		}
	}

	// this function is trying to compress the file tree to avoid a lot of folder openings which containing one single folder to open again and again
	// this method has side effects on the parameters
	function shrinkTree(root, parent, currentKey) {
		if (typeof root === 'object' && !Array.isArray(root)) {
			const props = Object.keys(root);

			if (props.length === 1) {
				const singlePropName = props[0];

				if (singlePropName !== 'FILES') {
					const mergedKey = `${currentKey}/${singlePropName}`;
					parent[mergedKey] = root[singlePropName];

					delete parent[currentKey];

					shrinkTree(parent[mergedKey], parent, mergedKey);
				}
			} else {
				props.forEach(prop => {
					shrinkTree(root[prop], root, prop);
				})
			}
		}
	}

	function createHtmlOfProperties(subtree) {
		const keys = Object.keys(subtree);

		// keys.sort((a, b) => a.localeCompare(b));
		keys.sort();

		if (keys.length) {
			const children = [];

			keys.forEach(key => {
				if (key !== 'FILES') {
					const subHtml = createHtmlOfProperties(subtree[key]);

					children.push(
						`<li>
							<span class="folder-name">${key}/</span>
							${subHtml}
						</li>`);
				} else {
					const files = subtree[key];

					files.sort((a, b) => a.filePath.localeCompare(b.filePath));

					files.forEach(fileDetails =>
						children.push(`<li class="file-name ${fileDetails.deleted ? 'deleted' : ''} ${fileDetails.fileType.replace('.', '')}" data-anchor="${fileDetails.anchor}">
							<a class="file-link" href="#" data-anchor="${fileDetails.anchor}">
								${fileDetails.filePath.substr(fileDetails.filePath.lastIndexOf('/') + 1)}
							</a>
						</li>`)
					);
				}
			});

			return `<ul>${children.join('')}</ul>`;
		} else {
			return '';
		}

	}

	function selectReviewOptionAndSubmit(optionValue) {
		const reviewForm = document.querySelector('#review-changes-modal form');

		const approveOption = reviewForm.querySelector(`input[type="radio"][value="${optionValue}"]`);

		approveOption.click();

		reviewForm.submit();
	}

	function renderActionButtons() {
		const existingButtonContainer = document.getElementById(ID_ACTION_BUTTON_CONTAINER);

		if (!existingButtonContainer) {
			const buttonContainer = document.createElement('div');
			buttonContainer.setAttribute('id', ID_ACTION_BUTTON_CONTAINER);

			buttonContainer.insertAdjacentHTML('beforeend', `
				<button type="button" id="${ID_NEEDS_WORK_BUTTON}" class="ml-2 btn btn-large btn-danger">Needs Work</button>
				<button type="button" id="${ID_APPROVE_BUTTON}" class="ml-1 btn btn-large btn-primary">Holy Approve</button>
			`);

			document.querySelector('.gh-header-actions').insertAdjacentElement('beforeend', buttonContainer);

			document.getElementById(ID_APPROVE_BUTTON).addEventListener('click', () => {
				const reviewCommentField = document.getElementById('pull_request_review_body');

				reviewCommentField.value = '';

				selectReviewOptionAndSubmit('approve');
			});

			document.getElementById(ID_NEEDS_WORK_BUTTON).addEventListener('click', () => {
				const reviewCommentField = document.getElementById('pull_request_review_body');

				reviewCommentField.value = 'Please fix review items.';

				selectReviewOptionAndSubmit('reject');
			});
		}
	}

	function renderFileTree() {
		const filesNode = document.getElementById('files');
		const filesTabCounter = document.getElementById('files_tab_counter');

		const numberOfChangedFiles = filesTabCounter ? parseInt(document.getElementById('files_tab_counter').textContent.trim()) : null;
		const numberOfFileHeaders = document.querySelectorAll(SELECTOR_FILE_HEADERS).length;

		if (filesNode && filesTabCounter && numberOfChangedFiles && numberOfFileHeaders && !state.isFileTreeFullyRendered) {
			const existingFileSelector = document.getElementById(ID_FILE_SELECTOR);

			if (existingFileSelector) {
				existingFileSelector.remove();
			}

			const newFileSelector = document.createElement('div');
			newFileSelector.setAttribute('id', ID_FILE_SELECTOR);

			let fileTreeHtmlString = `
				<header id="mighty-file-selector-header">
					<button type="button" id="${ID_TOGGLE_FILE_TREE_BUTTON}">↹</button>
					<h3>Mighty file tree</h3>
					<a href="#" id="${ID_TOGGLE_ALL_DIFF}">See all diffs</a>
				</header>`;

			let fileDetails = [];

			if (numberOfChangedFiles === numberOfFileHeaders) {
				fileDetails = Array.from(document.querySelectorAll(SELECTOR_FILE_HEADERS)).map(element => {
					// it seems to be not an accurate method
					// const numberOfAddedDiffBlock = element.querySelectorAll('.block-diff-added').length;
					// const numberOfNeutralDiffBlock = element.querySelectorAll('.block-diff-neutral').length;
					// const numberOfDeletedDiffBlock = element.querySelectorAll('.block-diff-deleted').length;

					return {
						element,
						anchor: element.dataset.anchor,
						filePath: element.dataset.path,
						fileType: element.dataset.fileType,
						deleted: element.dataset.fileDeleted === 'true'
						// newFile: numberOfAddedDiffBlock > 0 && numberOfDeletedDiffBlock === 0 && numberOfNeutralDiffBlock === 0
					}
				});

				const fileTree = {};

				fileDetails.forEach(fileDetails => {
					const parts = fileDetails.filePath.split('/');

					addToTree(fileTree, parts, fileDetails);
				})

				Object.keys(fileTree).forEach(key => {
					shrinkTree(fileTree[key], fileTree, key);
				});

				fileTreeHtmlString += `
					<div id="mighty-file-selector-tree-container">
						${createHtmlOfProperties(fileTree)}
					</div>`;

				state.isFileTreeFullyRendered = true;
			} else {
				fileTreeHtmlString += `
					<div id="mighty-file-selector-loader-message">
						<div id="mighty-file-loading-spinner">⟳</div>
						<p>${numberOfFileHeaders} of ${numberOfChangedFiles} file diffs has been loaded...</p>
					</div>
				`

				state.isFileTreeFullyRendered = false;
			}

			newFileSelector.insertAdjacentHTML('afterbegin', fileTreeHtmlString);

			document.body.append(newFileSelector);

			if (numberOfChangedFiles === numberOfFileHeaders) {
				document.getElementById(ID_FILE_SELECTOR).addEventListener('click', (event) => {
					if (event.target.dataset && event.target.dataset.anchor) {
						const selectedAnchor = event.target.dataset.anchor;
						event.target.closest('.file-name').classList.add('mighty-seen-already')

						fileDetails.forEach(({ element, anchor }) => {
							if (anchor === selectedAnchor) {
								element.parentNode.classList.remove('mighty-hidden');
							} else {
								element.parentNode.classList.add('mighty-hidden');
							}
						})
					} else if (event.target.classList.contains('folder-name')) {
						const folderNameNode = event.target;
						const ulListOfFolder = folderNameNode.nextElementSibling;

						ulListOfFolder.classList.toggle('mighty-hidden');
					} else if (event.target.id === ID_TOGGLE_FILE_TREE_BUTTON) {
						document.body.classList.toggle(CLASS_COLLAPSED);
					} else if (event.target.id === ID_TOGGLE_ALL_DIFF) {
						fileDetails.forEach(({ element, }) => {
							element.parentNode.classList.remove('mighty-hidden');
						});
					}
				})
			}

		}
	}

	function initializeMightyDiffViewer() {
		// before making our own DOM changes, let's stop watching for it
		stopObservingDomChanges();

		document.body.classList.add(CLASS_FULL_WIDTH);
		document.body.classList.add(CLASS_ACTIVE);

		renderActionButtons();

		renderFileTree();

		// restart watching for DOM changes
		startObservingDomChanges();
	}

	function isActualPageRelevant() {
		const path = window.location.pathname;
		const hasFileDiffs = document.getElementById('files');

		return path.includes('pull') && path.endsWith('/files') && hasFileDiffs;
	}

	function renderOrDestroyBasedOnActualPage() {
		if (isActualPageRelevant()) {
			initializeMightyDiffViewer();
		} else {
			destroyMightyDiffViewer();
		}
	}

	function startObservingDomChanges() {
		observer && observer.observe(document.body, {
			childList: true,
			subtree: true
		});
	}

	function stopObservingDomChanges() {
		observer && observer.disconnect();
	}

	function init() {
		renderOrDestroyBasedOnActualPage();

		observer = new MutationObserver(renderOrDestroyBasedOnActualPage);

		startObservingDomChanges();
	}

	init();

})();
