import {
    AfterContentInit,
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    ComponentFactory,
    ComponentFactoryResolver,
    ComponentRef,
    ContentChild,
    ContentChildren,
    EventEmitter,
    HostBinding,
    Input,
    OnInit,
    Output,
    QueryList,
    TemplateRef,
    ViewChild,
    ViewChildren,
    ViewContainerRef,
    ViewEncapsulation
} from "@angular/core";
import { Subscription } from "rxjs/Subscription";
import { cloneArray } from "../core/utils";
import { DataType } from "../data-operations/data-util";
import { FilteringLogic } from "../data-operations/filtering-expression.interface";
import { SortingDirection } from "../data-operations/sorting-expression.interface";
import { IgxGridAPIService } from "./api.service";
import { IgxGridCellComponent } from "./cell.component";
import { IgxColumnComponent } from "./column.component";
import { IgxGridRowComponent } from "./row.component";

let NEXT_ID = 0;

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
    selector: "igx-grid",
    templateUrl: "./grid.component.html",
    styleUrls: ["./grid.component.scss"],
    encapsulation: ViewEncapsulation.None,
    preserveWhitespaces: false
})
export class IgxGridComponent implements OnInit, AfterContentInit {

    @Input()
    public data = [];

    @Input()
    public autogenerate = false;

    @Input()
    public id = `igx-grid-top-${NEXT_ID++}`;

    @Input()
    get filteringLogic(): string {
        return this._filteringLogic === FilteringLogic.And ? "AND" : "OR";
    }

    set filteringLogic(value: string) {
        this._filteringLogic = (value === "OR") ? FilteringLogic.Or : FilteringLogic.And;
    }

    @Input()
    get filteringExpressions() {
        return this._filteringExpressions;
    }

    set filteringExpressions(value) {
        this._filteringExpressions = cloneArray(value);
        this.cdr.markForCheck();
    }

    @Input()
    get paging(): boolean {
        return this._paging;
    }

    set paging(value: boolean) {
        this._paging = value;
        this._refresh = !this._refresh;
        this.cdr.markForCheck();
    }

    @Input()
    get page(): number {
        return this._page;
    }

    set page(val: number) {
        if (val < 0) {
            return;
        }
        this.onPaging.emit({ previous: this._page, current: val });
        this._page = val;
    }

    @Input()
    get perPage(): number {
        return this._perPage;
    }

    set perPage(val: number) {
        if (val < 0) {
            return;
        }
        this._perPage = val;
        this.page = 0;
    }

    @Input()
    public paginationTemplate: TemplateRef<any>;

    @Input()
    public height;

    @Input()
    public width;

    @Input()
    public evenRowCSS = "";

    @Input()
    public oddRowCSS = "";

    @Output()
    public onSelection = new EventEmitter();

    @Output()
    public onColumnInit = new EventEmitter();

    @Output()
    public onSorting = new EventEmitter();

    @Output()
    public onFiltering = new EventEmitter();

    @Output()
    public onPaging = new EventEmitter();

    @Output()
    public onRowAdded = new EventEmitter();

    @Output()
    public onRowDeleted = new EventEmitter();

    @ContentChildren(IgxColumnComponent, { read: IgxColumnComponent })
    public columnList: QueryList<IgxColumnComponent>;

    @ViewChildren(IgxGridRowComponent, { read: IgxGridRowComponent })
    public rowList: QueryList<IgxGridRowComponent>;

    @HostBinding("attr.tabindex")
    public tabindex = 0;

    get refresh() {
        return this._refresh;
    }

    public sortingExpressions = [];

    public pagingState;

    protected _perPage = 15;
    protected _page = 0;
    protected _paging = false;
    protected _refresh = false;
    protected _columns = [];
    protected _filteringLogic = FilteringLogic.And;
    protected _filteringExpressions = [];

    private sub$: Subscription;

    constructor(private gridAPI: IgxGridAPIService,
                public cdr: ChangeDetectorRef,
                private resolver: ComponentFactoryResolver,
                private viewRef: ViewContainerRef) {
    }

    public ngOnInit() {
        this.gridAPI.register(this);
    }

    public ngAfterContentInit() {
        if (this.autogenerate) {
            this.autogenerateColumns();
        }
        this.columnList.forEach((col, idx) => {
            col.index = idx;
            col.gridID = this.id;
            this.onColumnInit.emit(col);
        });
        this._columns = this.columnList.toArray();
    }

    get columns(): IgxColumnComponent[] {
        return this._columns;
    }

    public getColumnByName(name: string): IgxColumnComponent {
        return this.columnList.find((col) => col.field === name);
    }

    get visibleColumns(): IgxColumnComponent[] {
        return this.columnList.filter((col) => !col.hidden).sort((col1, col2) => col1.index - col2.index);
    }

    public getCellByColumn(rowIndex: number, columnField: string): IgxGridCellComponent {
        return this.gridAPI.get_cell_by_field(this.id, rowIndex, columnField);
    }

    get totalPages(): number {
        if (this.pagingState) {
            return this.pagingState.metadata.countPages;
        }
        return -1;
    }

    get totalRecords(): number {
        if (this.pagingState) {
            return this.pagingState.metadata.countRecords;
        }
    }

    get isFirstPage(): boolean {
        return this.page === 0;
    }

    get isLastPage(): boolean {
        return this.page + 1 >= this.totalPages;
    }

    public nextPage(): void {
        if (!this.isLastPage) {
            this.page += 1;
        }
    }

    public previousPage(): void {
        if (!this.isFirstPage) {
            this.page -= 1;
        }
    }

    public paginate(val: number): void {
        if (val < 0) {
            return;
        }
        this.page = val;
    }

    public addRow(data: any) {
        this.data.push(data);
        this.onRowDeleted.emit({ data });
        this._refresh = !this._refresh;
        this.cdr.markForCheck();
    }

    public deleteRow(rowIndex: number) {
        const index = this.data.indexOf(this.gridAPI.get_row(this.id, rowIndex).rowData);
        const row = this.gridAPI.get_row(this.id, rowIndex);
        if (index > -1) {
            this.data.splice(index, 1);
            this.onRowDeleted.emit({ row });
            this._refresh = !this._refresh;
            this.cdr.markForCheck();
        }
    }

    public sort(name: string, direction = SortingDirection.Asc) {
        this.gridAPI.sort(this.id, name, direction);
        this.cdr.markForCheck();
    }

    public sortMultiple(exprArray) {
        this.gridAPI.sort_multiple(this.id, exprArray);
        this.cdr.markForCheck();
    }

    public filter(name: string, value: any, condition?, ignoreCase?) {
        const col = this.gridAPI.get_column_by_name(this.id, name);
        if (!col) {
            return;
        }
        this.gridAPI.filter(
            this.id, name, value, condition || col.filteringCondition, ignoreCase || col.filteringIgnoreCase);
        this.page = 0;
    }

    public filterGlobal(value: any, condition?, ignoreCase?) {
        // TODO: AND OR Filtering logic
        this.gridAPI.filterGlobal(this.id, value, condition, ignoreCase);
        this.page = 0;
    }

    public clearFilter(name: string) {
        const col = this.gridAPI.get_column_by_name(this.id, name);
        if (!col) {
            return;
        }

        this.gridAPI.clear_filter(this.id, name);
    }

    public clearFilterAll() {

    }

    get hasSortableColumns(): boolean {
        return this.columnList.some((col) => col.sortable);
    }

    get hasEditableColumns(): boolean {
        return this.columnList.some((col) => col.editable);
    }

    get hasFilterableColumns(): boolean {
        return this.columnList.some((col) => col.filterable);
    }

    get selectedCells(): IgxGridCellComponent[] | any[] {
        if (this.rowList) {
            return this.rowList.map((row) => row.cells.filter((cell) => cell.selected))
                .reduce((a, b) => a.concat(b), []);
        }
        return [];
    }

    protected resolveDataTypes(rec) {
        if (typeof rec === "number") {
            return DataType.Number;
        } else if (typeof rec === "boolean") {
            return DataType.Boolean;
        } else if (typeof rec === "object" && rec instanceof Date) {
            return DataType.Date;
        }
        return DataType.String;
    }

    protected autogenerateColumns() {
        const factory = this.resolver.resolveComponentFactory(IgxColumnComponent);
        const fields = Object.keys(this.data[0]);
        const columns = [];

        fields.forEach((field) => {
            const ref = this.viewRef.createComponent(factory);
            ref.instance.field = field;
            ref.instance.dataType = this.resolveDataTypes(this.data[0][field]);
            ref.changeDetectorRef.detectChanges();
            columns.push(ref.instance);
        });

        this.columnList.reset(columns);
    }
}
