import {Model, HydratedDocument} from "mongoose";

class DBService<T> {

    private readonly fields:string[];
    private readonly Model:Model<T>;

    constructor(Model:Model<T>, populatedPaths:string[]) {
        this.Model = Model;
        this.fields = populatedPaths;
    }

    protected saveMany(data:any[], session:any = null): Promise< HydratedDocument<T>[] > {
        return this.Model.insertMany(data, {session: session});
    }

    protected save(data:T, session:any = null): Promise<any> {
        const model = new this.Model(data);
        return model.save({session: session});
    }

    protected find(query:any, limit = 300, sort = {}, session = null): Promise< HydratedDocument<T>[] > {
        return new Promise((resolve, reject) => {
            this.Model.find(query)
                .session(session)
                .limit(limit)
                .sort(sort)
                .then((data) => {
                    resolve(data);
                })
                .catch((e) => {
                    reject(e);
                })
            ;
        });
    }

    protected findWithPopulate(query:any, limit = 300, sort = {}, session = null): Promise< HydratedDocument<T>[] > {
        return new Promise((resolve, reject) => {
            this.Model.find(query)
                .session(session)
                .limit(limit)
                .populate(this.fields)
                .sort(sort)
                .then((data:any) => {
                    resolve(data);
                })
                .catch((e) => {
                    reject(e);
                })
            ;
        });
    }


    protected paginate(query:any, limit = 300, sort = {}, page = 1): Promise< HydratedDocument<T>[] > {
        const customLabels = {
            totalDocs: 'itemCount',
            docs: 'data',
            limit: 'perPage',
            page: 'currentPage',
            nextPage: 'next',
            prevPage: 'prev',
            totalPages: 'pageCount',
            pagingCounter: 'slNo',
            meta: 'paginator'
        };

        const options = {
            page: page,
            limit: limit,
            sort: sort,
            customLabels: customLabels
        };

        return new Promise((resolve, reject) => {
            // @ts-ignore
            this.Model.paginate(query, options)
                .then((data:any) => {
                    resolve(data);
                })
                .catch((e:Error) => {
                    reject(e);
                })
            ;
        });
    }

    protected paginateWithPopulate(query:any, limit = 300, sort = {}, page = 1): Promise< HydratedDocument<T>[] > {
        const customLabels = {
            totalDocs: 'itemCount',
            docs: 'data',
            limit: 'perPage',
            page: 'currentPage',
            nextPage: 'next',
            prevPage: 'prev',
            totalPages: 'pageCount',
            pagingCounter: 'slNo',
            meta: 'paginator'
        };

        const options = {
            page: page,
            limit: limit,
            sort: sort,
            customLabels: customLabels,
            populate: this.fields
        };

        return new Promise((resolve, reject) => {
            // @ts-ignore
            this.Model.paginate(query, options)
                .then((data:any) => {
                    resolve(data);
                })
                .catch((e:Error) => {
                    reject(e);
                })
            ;
        });
    }

    protected findById(id:string, session:any = null): Promise< HydratedDocument<T>[] > {
        return new Promise((resolve, reject) => {
            this.Model.findById(id).session(session)
                .then((data:any) => {
                    resolve(data);
                })
                .catch((e:Error) => {
                    reject(e);
                })
            ;
        });
    }

    protected findByIdWithPopulate(id:string, session:any = null): Promise< HydratedDocument<T>[] > {
        return new Promise((resolve, reject) => {
            this.Model.findById(id).session(session)
                .populate(this.fields)
                .session(session)
                .then((data:any) => {
                    resolve(data);
                })
                .catch((e:Error) => {
                    reject(e);
                })
            ;
        });
    }

    protected findOne(query:any, session = null): Promise< HydratedDocument<T>[] > {
        return new Promise((resolve, reject) => {
            this.Model.findOne(query)
                .session(session)
                .then((data:any) => {
                    resolve(data);
                })
                .catch((e:Error) => {
                    reject(e);
                })
            ;
        });
    }

    protected findOneWithPopulate(query:any, session = null): Promise< HydratedDocument<T>[] > {
        return new Promise((resolve, reject) => {
            this.Model.findOne(query)
                .populate(this.fields)
                .session(session)
                .then((data:any) => {
                    resolve(data);
                })
                .catch((e:Error) => {
                    reject(e);
                })
            ;
        });
    }

    protected update(id:string, data:any, session:any = null): Promise<any> {
        return this.Model.findByIdAndUpdate(id, data, {new: true}).session(session).exec();
    }

    protected updateOne(query:any, data:any, session:any = null): Promise<any> {
        return this.Model.findOneAndUpdate(query, data, {new: true}).session(session).exec();
    }

    protected updateMany(query:any, data:any[], session:any = null): Promise<any> {
        return this.Model.updateMany(query, data).session(session).exec();
    }
}

export default DBService;