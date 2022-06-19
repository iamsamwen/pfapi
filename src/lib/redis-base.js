'use strict';

const IORedis = require('ioredis');

class RedisBase {

    constructor(uri = 'redis://localhost/0') {
        this.config = this.parse_uri(uri);
        this.clients = [];
    }

    /**
     * if the primary client doesn't exist, it alway creates it first.
     * if new_client is false, it returns the primary client. 
     * if new_client is true, it always returns a newly created client.
     * the new client may use for subscription
     * 
     * @param {*} new_client 
     * @returns Redis Cache
     */
    async get_client(new_client = false) {
        if (!this.primary_client) {
            this.primary_client = await this.create_new_client();
        }
        if (!new_client) {
            return this.primary_client;
        } else {
            const client = await this.create_new_client();
            this.clients.push(client);
            return client;
        }
    }

    /**
     * helper function for send command
     * @param {*} param0 
     * @returns 
     */
    send_command({client, cmd, argv, replyEncoding = null}) {
        return new Promise((resolve, reject) => {
            const command = new IORedis.Command(cmd, argv, { replyEncoding }, 
                (err, result) => err ? 
                    reject(err) : 
                    resolve(Buffer.isBuffer(result) ? result.toString('utf-8') : result)
                );
            client.sendCommand(command);
        });
    }

    /**
     * 
     * @param {*} client to close this client, without client will close all clients
     * @returns 
     */
    async close(client) {
        if (client) {
            return await this.close_client(client);
        } else {
            if (this.primary_client) {
                await this.close_client(this.primary_client);
            }
            for (const client of this.clients) {
                await this.close_client(client);
            }
        }
    }

    get is_cluster() {
        return this.cluster;
    }

    async list_clients() {
        const client = await this.get_client();
        const result = await client.client('list');
        return result.split('\n').filter(x => x);
    }

    async list_commands() {
        const client = await this.get_client();
        return client.getBuiltinCommands();
    }

    async flushall() {
        const client = await this.get_client();
        if (this.is_cluster) {
            const nodes = client.nodes();
            const master_nodes = nodes.map(x => x && x.options && !x.options.readOnly);
            if (master_nodes.length === 0) {
                console.error('unexpected, no master node found!');
                return false;
            }
            for (const master_node of master_nodes) {
                if (!await master_node.flushall()) {
                    console.error('failed, master node flushall');
                }
            }
        } else {
            if (!await client.flushall()) {
                console.error('failed, node flushall');
                return false;
            }
        }
        return true;
    }

    async close_client(client) {
        await client.disconnect(false);
        await client.quit();
        if (client === this.primary_client) {
            this.primary_client = null;
        } else {
            const index = this.clients.indexOf(client);
            if (index !== -1) {
                this.clients.splice(index, 1);
            }
        }
    }

    parse_uri(uri) {
        let {protocol, host, username, password, port, pathname } = new URL(uri);
        if (protocol !== 'redis:') {
            throw new Error(`unexpected protocol ${protocol}`);
        }
        if (!port) port = 6379;
        if (!pathname) pathname = '/0';
        const db = Number(pathname.split('/').pop());
        const hosts = host.split(',');
        if (hosts.length === 1) {
            return {host, port, username, password, db};
        } else {
            const config = [];
            for (const host of hosts) {
                this.config.push({host, port, username, password, db});
            }
            return config;
        }
    }

    create_new_client() {
        return new Promise(resolve => {
            let client;
            if (Array.isArray(this.config)) {
                this.cluster = true;
                client = new IORedis.Cluster(this.config, {
                    scaleReads: 'all',
                    enableReadyCheck: true,
                    slotsRefreshTimeout: 10000,
                    tls: {},
                    dnsLookup: (address, callback) => callback(null, address), 
                    clusterRetryStrategy: (times) => { 
                        return Math.min(times * 600, 3000);
                    }
                });
            } else {
                this.cluster = false;
                client = new IORedis({...this.config,
                    enableReadyCheck: true,
                    retryStrategy: (times) => {
                        return Math.min(times * 600, 3000);
                    }
                });
            }
            client.on('error', (err) => {
                client.disconnect(true);
                console.error(err.message);
            });
            client.once('ready', () => {
                resolve(client);
            });       
        });
    }
}

module.exports = RedisBase;