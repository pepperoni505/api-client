// Types
export declare class MetarResponse {
    icao: string;
    source: string;
    metar: string;
}

export declare class TafResponse {
    icao: string;
    source: string;
    taf: string;
}

export declare class AtisResponse {
    icao: string;
    source: string;
    combined?: string;
    arr?: string;
    dep?: string;
}

export declare class AirportResponse {
    icao: string;
    type: string;
    name: string;
    lat: number;
    lon: number;
    elevation: number;
    continent: string;
    country: string;
    transAlt: number;
}

export declare class TelexConnection {
    id: string;
    isActive: boolean;
    firstContact: Date;
    lastContact: Date;
    flight: string;
    location: {
        x: number;
        y: number;
    };
    trueAltitude: number;
    heading: number;
    freetextEnabled: boolean;
    aircraftType: string;
    origin: string;
    destination: string;
}

export declare class TelexMessage {
    id: string;
    createdAt: Date;
    received: boolean;
    message: string;
    isProfane: boolean;
    from: TelexConnection;
    to: TelexConnection;
}

export declare class Token {
    accessToken: string;
    connection: string;
    flight: string;
}

export declare class AircraftStatus {
    location: {
        long: number;
        lat: number;
    };
    trueAltitude: number;
    heading: number;
    origin: string;
    destination: string;
    freetextEnabled: boolean;
    flight: string;
    aircraftType: string;
}

export declare class CommitInfo {
    sha: string;
    timestamp: Date;
}

export declare class ReleaseInfo {
    name: string;
    publishedAt: Date;
    htmlUrl: string;
}

export declare class Paginated<T> {
    results: T[];
    count: number;
    total: number;
}

export declare class Bounds {
    north: number;
    east: number;
    south: number;
    west: number;
}

export declare type StageCallback = (flights: TelexConnection[]) => void;

export class HttpError extends Error {
    public readonly status;

    constructor(status: number, message?: string) {
        super(message);
        this.status = status;
    }
}

export class TelexNotConnectedError extends Error {
    constructor() {
        super("TELEX is not connected");
    }
}


export class NXApi {
    public static url = new URL("https://api.flybywiresim.com");
}

export class Metar {
    public static get(icao: string, source?: string): Promise<MetarResponse> {
        if (!icao) {
            throw new Error("No ICAO provided");
        }

        let url = new URL(`/metar/${icao}`, NXApi.url);
        if (source) {
            url.searchParams.set("source", source);
        }

        return fetch(url.href)
            .then((response) => {
                if (!response.ok) {
                    throw new HttpError(response.status);
                }

                return response.json();
            });
    }
}

export class Atis {
    public static get(icao: string, source?: string): Promise<AtisResponse> {
        if (!icao) {
            throw new Error("No ICAO provided");
        }

        let url = new URL(`/atis/${icao}`, NXApi.url);
        if (source) {
            url.searchParams.set("source", source);
        }

        return fetch(url.href)
            .then((response) => {
                if (!response.ok) {
                    throw new HttpError(response.status);
                }

                return response.json();
            });
    }
}

export class Taf {
    public static get(icao: string, source?: string): Promise<TafResponse> {
        if (!icao) {
            throw new Error("No ICAO provided");
        }

        let url = new URL(`/taf/${icao}`, NXApi.url);
        if (source) {
            url.searchParams.set("source", source);
        }

        return fetch(url.href)
            .then((response) => {
                if (!response.ok) {
                    throw new HttpError(response.status);
                }

                return response.json();
            });
    }
}

export class Telex {
    private static accessToken: string;

    public static refreshRate = 15000;

    public static connect(status: AircraftStatus): Promise<Token> {
        const connectBody = Telex.buildBody(status);
        const headers = {
            "Content-Type": "application/json"
        };

        let url = new URL(`/txcxn`, NXApi.url);

        return fetch(url.href, {method: "POST", body: JSON.stringify(connectBody), headers})
            .then((response) => {
                if (!response.ok) {
                    throw new HttpError(response.status);
                }

                return response.json()
                    .then((data) => {
                        Telex.accessToken = data.accessToken;
                        return data;
                    });
            });
    }

    public static update(status: AircraftStatus): Promise<TelexConnection> {
        Telex.connectionOrThrow();

        const connectBody = Telex.buildBody(status);
        const headers = {
            "Content-Type": "application/json",
            Authorization: Telex.buildToken()
        };

        let url = new URL(`/txcxn`, NXApi.url);

        return fetch(url.href, {method: "PUT", body: JSON.stringify(connectBody), headers})
            .then((response) => {
                if (!response.ok) {
                    throw new HttpError(response.status);
                }

                return response.json();
            });
    }

    public static disconnect(): Promise<void> {
        Telex.connectionOrThrow();

        const headers = {
            Authorization: Telex.buildToken()
        };

        let url = new URL(`/txcxn`, NXApi.url);

        return fetch(url.href, {method: "DELETE", headers})
            .then((response) => {
                if (!response.ok) {
                    throw new HttpError(response.status);
                }

                Telex.accessToken = "";
            });
    }

    public static sendMessage(recipientFlight: string, message: string): Promise<TelexMessage> {
        Telex.connectionOrThrow();

        const body = {
            to: recipientFlight,
            message: message,
        };
        const headers = {
            "Content-Type": "application/json",
            Authorization: Telex.buildToken()
        };

        let url = new URL(`/txmsg`, NXApi.url);

        return fetch(url.href, {method: "POST", body: JSON.stringify(body), headers})
            .then((response) => {
                if (!response.ok) {
                    throw new HttpError(response.status);
                }

                return response.json();
            });
    }

    public static fetchMessages(): Promise<TelexMessage[]> {
        Telex.connectionOrThrow();

        const headers = {
            Authorization: Telex.buildToken()
        };

        let url = new URL(`/txmsg`, NXApi.url);

        return fetch(url.href, {method: "GET", headers})
            .then((response) => {
                if (!response.ok) {
                    throw new HttpError(response.status);
                }

                return response.json();
            });
    }

    public static fetchConnections(skip?: number, take?: number, bounds?: Bounds): Promise<Paginated<TelexConnection>> {
        let url = new URL(`/txcxn`, NXApi.url);
        if (skip) {
            url.searchParams.set("skip", skip.toString());
        }
        if (take) {
            url.searchParams.append("take", take.toString());
        }
        if (bounds) {
            url.searchParams.append("north", bounds.north.toString());
            url.searchParams.append("east", bounds.east.toString());
            url.searchParams.append("south", bounds.south.toString());
            url.searchParams.append("west", bounds.west.toString());
        }

        return fetch(url.href, {method: "GET"})
            .then((response) => {
                if (!response.ok) {
                    throw new HttpError(response.status);
                }

                return response.json();
            });
    }

    public static async fetchAllConnections(bounds?: Bounds, stageCallback?: StageCallback): Promise<TelexConnection[]> {
        let flights: TelexConnection[] = [];
        let skip = 0;
        let total = 0;

        do {
            try {
                const data = await Telex.fetchConnections(skip, 100, bounds);

                total = data.total;
                skip += data.count;
                flights = flights.concat(data.results);

                if (stageCallback) {
                    stageCallback(flights);
                }
            } catch (err) {
                console.error(err);
                break;
            }
        }
        while (total > skip);

        return flights;
    }

    public static fetchConnection(id: string): Promise<TelexConnection> {
        let url = new URL(`/txcxn/${id}`, NXApi.url);

        return fetch(url.href, {method: "GET"})
            .then((response) => {
                if (!response.ok) {
                    throw new HttpError(response.status);
                }

                return response.json();
            });
    }

    public static findConnection(flightNumber: string): Promise<TelexConnection> {
        let url = new URL(`/txcxn/_find`, NXApi.url);
        url.searchParams.set("flight", flightNumber);

        return fetch(url.href, {method: "GET"})
            .then((response) => {
                if (!response.ok) {
                    throw new HttpError(response.status);
                }

                return response.json();
            });
    }

    public static countConnections(): Promise<number> {
        let url = new URL(`/txcxn/_count`, NXApi.url);

        return fetch(url.href, {method: "GET"})
          .then((response) => {
              if (!response.ok) {
                  throw new HttpError(response.status);
              }

              return response.json();
          });
    }

    private static buildBody(status: AircraftStatus) {
        return {
            location: {
                x: status.location.long,
                y: status.location.lat,
            },
            trueAltitude: status.trueAltitude,
            heading: status.heading,
            origin: status.origin,
            destination: status.destination,
            freetextEnabled: status.freetextEnabled,
            flight: status.flight,
            aircraftType: status.aircraftType,
        };
    }

    private static buildToken(): string {
        return `Bearer ${Telex.accessToken}`;
    }

    private static connectionOrThrow() {
        if (!Telex.accessToken) {
            throw new TelexNotConnectedError();
        }
    }
}

export class Airport {
    public static get(icao: string): Promise<AirportResponse> {
        if (!icao) {
            throw new Error("No ICAO provided");
        }

        let url = new URL(`/api/v1/airport/${icao}`, NXApi.url);

        return fetch(url.href)
          .then((response) => {
              if (!response.ok) {
                  throw new HttpError(response.status);
              }

              return response.json();
          });
    }
}

export class GitVersions {
    public static getNewestCommit(user: string, repo: string, branch: string): Promise<CommitInfo> {
        if (!user || !repo || !branch) {
            throw new Error("Missing argument");
        }

        let url = new URL(`/api/v1/git-versions/${user}/${repo}/branches/${branch}`, NXApi.url);

        return fetch(url.href)
          .then((response) => {
              if (!response.ok) {
                  throw new HttpError(response.status);
              }

              return response.json();
          });
    }

    public static getReleases(user: string, repo: string): Promise<ReleaseInfo[]> {
        if (!user || !repo) {
            throw new Error("Missing argument");
        }

        let url = new URL(`/api/v1/git-versions/${user}/${repo}/releases`, NXApi.url);

        return fetch(url.href)
          .then((response) => {
              if (!response.ok) {
                  throw new HttpError(response.status);
              }

              return response.json();
          });
    }
}
