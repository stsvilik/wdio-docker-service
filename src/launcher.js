import fs from 'fs-extra';
import Docker from './utils/docker';
import getFilePath from './utils/getFilePath';
import logger from '@wdio/logger';

const DEFAULT_LOG_FILENAME = 'docker-log.txt';
const Logger = logger('wdio-docker-service');

class DockerLauncher {
    constructor() {
        this.logToStdout = false;
        this.docker = null;
        this.dockerLogs = null;
    }

    onPrepare(config) {
        this.logToStdout = config.logToStdout;
        this.dockerLogs = config.dockerLogs;

        Logger.setLevel(config.logLevel || 'info');

        const {
            dockerOptions: {
                args,
                command,
                healthCheck,
                image,
                options,
            },
            onDockerReady
        } = config;

        if (!image) {
            return Promise.reject(new Error('dockerOptions.image is a required property'));
        }

        this.docker = new Docker(image, {
            args,
            command,
            healthCheck,
            options,
        }, Logger);

        if (typeof this.dockerLogs === 'string') {
            const logFile = getFilePath(this.dockerLogs, DEFAULT_LOG_FILENAME);

            this.docker.once('processCreated', () => {
                this._redirectLogStream(logFile);
            });
        }

        return this.docker.run()
            .then(() => {
                if (typeof onDockerReady === 'function') {
                    onDockerReady();
                }
            })
            .catch((err) => {
                Logger.error(`Failed to run container: ${ err.message }`);
            });
    }

    onComplete() {
        if (this.docker) {
            return this.docker.stop();
        }
    }

    /**
     * @param logFile
     * @private
     */
    _redirectLogStream(logFile) {
        // ensure file & directory exists
        return fs.ensureFile(logFile).then(() => {
            const logStream = fs.createWriteStream(logFile, { flags: 'w' });

            this.docker.process.stdout.pipe(logStream);
            this.docker.process.stderr.pipe(logStream);
        });
    }
}

module.exports = DockerLauncher;
