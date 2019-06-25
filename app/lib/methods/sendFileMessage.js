import reduxStore from '../createStore';
import database from '../realm';
import log from '../../utils/log';

const XHR = {};

export function isUploadActive(path) {
	return !!XHR[path];
}

export function cancelUpload(path) {
	if (XHR[path]) {
		XHR[path].abort();
	}
}

export function sendFileMessage(rid, fileInfo, tmid) {
	return new Promise((resolve, reject) => {
		const { FileUpload_MaxFileSize, Site_Url } = reduxStore.getState().settings;
		const { id, token } = reduxStore.getState().login.user;

		// -1 maxFileSize means there is no limit
		if (FileUpload_MaxFileSize > -1 && fileInfo.size > FileUpload_MaxFileSize) {
			return reject({ error: 'error-file-too-large' }); // eslint-disable-line
		}

		const uploadUrl = `${ Site_Url }/api/v1/rooms.upload/${ rid }`;

		const xhr = new XMLHttpRequest();
		const formData = new FormData();

		fileInfo.rid = rid;

		database.write(() => {
			try {
				database.create('uploads', fileInfo, true);
			} catch (e) {
				return log('err_send_file_message_create_upload_1', e);
			}
		});

		XHR[fileInfo.path] = xhr;
		xhr.open('POST', uploadUrl);

		formData.append('file', {
			uri: fileInfo.path,
			type: fileInfo.type,
			name: fileInfo.name
		});
		formData.append('description', fileInfo.description);

		if (tmid) {
			formData.append('tmid', tmid);
		}

		xhr.setRequestHeader('X-Auth-Token', token);
		xhr.setRequestHeader('X-User-Id', id);

		const handleProgress = ({ total, loaded }) => {
			database.write(() => {
				fileInfo.progress = Math.floor((loaded / total) * 100);
				try {
					database.create('uploads', fileInfo, true);
				} catch (e) {
					return log('err_send_file_message_create_upload_2', e);
				}
			});
		};

		xhr.addEventListener('progress', handleProgress);

		xhr.onload = () => {
			if (xhr.status >= 200 && xhr.status < 400) { // If response is all good...
				database.write(() => {
					const upload = database.objects('uploads').filtered('path = $0', fileInfo.path);
					try {
						database.delete(upload);
						const response = JSON.parse(xhr.response);
						resolve(response);
					} catch (e) {
						reject(e);
						log('err_send_file_message_delete_upload', e);
					}
				});
			} else {
				database.write(() => {
					fileInfo.error = true;
					try {
						database.create('uploads', fileInfo, true);
						const response = JSON.parse(xhr.response);
						reject(response);
					} catch (err) {
						reject(err);
						log('err_send_file_message_create_upload_3', err);
					}
				});
			}
		};

		xhr.onerror = (e) => {
			database.write(() => {
				fileInfo.error = true;
				try {
					database.create('uploads', fileInfo, true);
					reject(e);
				} catch (err) {
					reject(err);
					log('err_send_file_message_create_upload_3', err);
				}
			});
		};

		xhr.send(formData);
	});
}
