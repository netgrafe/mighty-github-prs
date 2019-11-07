(() => {
	function destroyMightyDiffViewer() {
		document.body.classList.remove('mighty-viewer-active');
		document.body.classList.remove('full-width');

		const fileSelector = document.getElementById('mighty-file-selector')

		if (fileSelector) {
			fileSelector.remove()
		}

		const buttonContainer = document.getElementById('mighty-action-buttons');

		if (buttonContainer) {
			buttonContainer.remove();
		}
	}

	function initializeMightyDiffViewer() {
		document.body.classList.add('full-width');
		document.body.classList.add('mighty-viewer-active');

		const fileDetails = Array.from(document.querySelectorAll('.file-header[data-anchor^="diff-"]')).map(element => {
			return {
				element,
				anchor: element.dataset.anchor,
				filePath: element.dataset.path,
				fileType: element.dataset.fileType,
				deleted: element.dataset.fileDeleted === 'true'
			}
		});

		// this function is building up a tree exactly based on the file path
		// this method has side effects on the parameters
		function addToTree(root, parts, fullFileDetails) {
	        const nextPart = parts.shift();

	        if (nextPart.includes('.')) {
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

	    const fileTree = {};

	    fileDetails.forEach(fileDetails => {
	        const parts = fileDetails.filePath.split('/');

	        addToTree(fileTree, parts, fileDetails);
	    })

	    Object.keys(fileTree).forEach(key => {
	        shrinkTree(fileTree[key], fileTree, key);
	    });

		const newDiv = document.createElement('div');

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
								<a class="file-link" href="#${fileDetails.anchor}" data-anchor="${fileDetails.anchor}">
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

		const fileTreeHtmlString = '<h3>Mighty file tree</h3>' + createHtmlOfProperties(fileTree);

		newDiv.setAttribute('id', 'mighty-file-selector');
		newDiv.insertAdjacentHTML('afterbegin', fileTreeHtmlString);


		document.body.append(newDiv);

		document.getElementById('mighty-file-selector').addEventListener('click', (event) => {
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
			}
		})


		const buttonContainer = document.createElement('div');
		buttonContainer.setAttribute('id', 'mighty-action-buttons');

		buttonContainer.insertAdjacentHTML('beforeend', `
			<button type="button" id="mighty-needs-work-button" class="ml-2 btn btn-large btn-danger">Needs Work</button>
			<button type="button" id="mighty-approve-button" class="ml-1 btn btn-large btn-primary">Holy Approve</button>
		`);

		document.querySelector('.gh-header-actions').insertAdjacentElement('beforeend', buttonContainer);

		document.getElementById('mighty-approve-button').addEventListener('click', () => {
			const reviewForm = document.querySelector('.pull-request-review-menu form');

			const approveOption = reviewForm.querySelector('input[type="radio"][value="approve"]');
			approveOption.click();

			reviewForm.submit();
		});

		document.getElementById('mighty-needs-work-button').addEventListener('click', () => {
			const reviewForm = document.querySelector('.pull-request-review-menu form');

			const reviewCommentField = document.getElementById('pull_request_review_body');

			reviewCommentField.value = 'Please fix review items.';

			const needsWorkOption = reviewForm.querySelector('input[type="radio"][value="reject"]');
			needsWorkOption.click();

			reviewForm.submit();
		})
	}

	function waitForTotalDiffLoad(callback) {
		const interval = setInterval(() => {
			const filesNode = document.getElementById('files');
			const filesTabCounter = document.getElementById('files_tab_counter');

			const numberOfChangedFiles = filesTabCounter ? parseInt(document.getElementById('files_tab_counter').textContent.trim()) : null;
			const numberOfFileHeaders = document.querySelectorAll('.file-header[data-anchor^="diff-"]').length;

			if (filesNode && numberOfFileHeaders === numberOfChangedFiles) {
				clearInterval(interval);
				callback();
			}
		}, 500);
	}

	function init() {
		if (window.location.pathname.endsWith('/files')) {
			waitForTotalDiffLoad(initializeMightyDiffViewer);
		}

		document.addEventListener('click', e => {
			const path = window.location.pathname;

			if (path.includes('pull') && path.endsWith('/files')) {
				const fileSelector = document.getElementById('mighty-file-selector');

				if (!fileSelector) {
					waitForTotalDiffLoad(initializeMightyDiffViewer)
				}
			} else {
				destroyMightyDiffViewer();
			}
		});
	}

	init();

})();