;(function($) {
    'use strict';

    var pluginName = 'tableEditCompare',
        defaults = {
            'save': function(data) {
                console.dir(data);
            },
            'dataProviders': {}
        };

    function Plugin(element, options) {
        this.options    = $.extend({}, defaults, options);
        this._defaults  = defaults;
        this._name      = pluginName;

        this.$element   = $(element);
        this.init();
    }

    Plugin.prototype.selectCell = function(event) {
        stop(event);
        var $el = $(event.target);

        $el.closest('tr').children('td').removeClass('selected');
        $el.closest('td').addClass('selected');
    };

    Plugin.prototype.selectColumn = function(event) {
        stop(event);
        var $el = $(event.target);
        var col = $el.data('column');

        var $tbody = $el.closest('tbody');

        $tbody.find('td.tec-data-cell')
            .removeClass('selected');

        $tbody.find('td.tec-data-cell:nth-of-type(' + col + ')')
            .addClass('selected');
    };

    Plugin.prototype.toggleEditing = function(event) {
        stop(event);

        var $a = $(event.target).closest('a');
        var $td = $a.closest('tr').find('td.selected');
        if ($td.length === 0) {
            return;
        }

        if ($a.hasClass('editing')) {
            this.updateCellText($td);
        }

        $a.toggleClass('editing');
        $td.toggleClass('editing');
    };

    Plugin.prototype.updateCellText = function($td) {
        var $inputs = $td.find('.cell-inputs .tec-input');
        var $spans = $td.find('.cell-data span[data-field]');

        if ($spans.length === 0) {
            $td.find('.cell-data').text($inputs[0].value);
            return;
        }

        for (var i = 0; i < $inputs.length; i++) {
            $($spans[i]).text($inputs[i].value);
        }
    };

    Plugin.prototype.save = function(event) {
        stop(event);

        var rowCount = this.$element.find('td.tec-data-cell').length / 2;
        var $selected = this.$element.find('td.tec-data-cell.selected');
        if (rowCount !== $selected.length) {
            alert('bad! select all the things');
            return;
        }

        var data = {};
        this.$element.children('tbody').each(function(idx, tbody) {
            var $tbody = $(tbody);
            var tbodyField = $tbody.data('field');
            if (typeof tbodyField !== 'undefined') {
                data[tbodyField] = {};
            }

            var $inputs = $tbody.find('td.tec-data-cell.selected .cell-inputs .tec-input');
            $inputs.each(function(idx, input) {
                if (typeof tbodyField === 'undefined') {
                    data[input.name] = input.value;
                } else {
                    data[tbodyField][input.name] = input.value;
                }
            });
        });

        if (typeof this.options.save === 'function') {
            this.options.save(data);
        }
    };

    Plugin.prototype.init = function() {
        this.$element.children('tbody').each(function(idx, tbody) {
            this.setupDataCells($(tbody));
            this.setupLabelCells($(tbody));
            this.addButtonRows($(tbody));
        }.bind(this));

        this.addSaveRow();
        this.addEventHandlers();
    };

    Plugin.prototype.setupDataCells = function($tbody) {
        var $cells = $tbody.find('td');

        $cells.each(function(idx, td) {
            var $td = $(td);

            var fieldNames = [];
            var fieldVals = [];

            var $spans = $td.find('span[data-field]');
            if ($spans.length === 0) {
                fieldNames.push($td.closest('[data-field]').data('field'));
                fieldVals.push($td.text());
            } else {
                $spans.each(function(unused, span) {
                    var $span = $(span);
                    fieldNames.push($span.data('field'));
                    fieldVals.push($span.text());
                });
            }

            var $inputWrapper = $('<div class="cell-inputs"></div>');
            for (var i = 0; i < fieldNames.length; i++) {
                var $input;
                if (this.hasDataProvider(fieldNames[i])) {
                    $input = this.buildSelectInput(fieldNames[i], fieldVals[i]);
                } else {
                    $input = this.buildTextInput(fieldNames[i], fieldVals[i]);
                }
                $inputWrapper.append($input);
            }

            $td.addClass('tec-data-cell')
                .wrapInner('<div class="cell-data"></div>')
                .append($inputWrapper);
        }.bind(this));
    };

    Plugin.prototype.hasDataProvider = function(name) {
        return typeof this.options.dataProviders[name] === 'function';
    };

    Plugin.prototype.getDataProvider = function(name) {
        return this.options.dataProviders[name];
    };

    Plugin.prototype.buildTextInput = function(fieldName, value) {
        return $('<input/>', {
            'type': 'text',
            'name': fieldName,
            'value': value,
            'class': 'tec-input'
        });
    };

    Plugin.prototype.buildSelectInput = function(fieldName, value) {
        var $select = $('<select/>', {
            'name': fieldName,
            'class': 'tec-input'
        });
        var options = this.getDataProvider(fieldName)();
        var values = Object.keys(options);
        for (var i = 0; i < values.length; i++) {
            var val = values[i];
            var text = options[val];

            var selected = (val === value) ? ' selected' : '';
            var $option = $('<option value="' + val + '"' + selected + '>' + text + '</option>');
            $select.append($option);
        }

        return $select;
    };

    Plugin.prototype.setupLabelCells = function($tbody) {
        $tbody.find('th').each(function(idx, th) {
            var $child = $('<a class="field-row-edit"><span class="tec-edit">Edit</span><span class="tec-save">Done</span></a>');
            $(th).append($child);
        });
    };

    Plugin.prototype.addButtonRows = function($tbody) {
        var $selectAllTr = $('<tr><td>&nbsp;</td><td><button class="tec-select-all" data-column="1">Select All</button></td><td><button class="tec-select-all" data-column="2">Select All</button></td><td>&nbsp;</td></tr>');
        $tbody.append($selectAllTr);
    };

    Plugin.prototype.addSaveRow = function() {
        var $saveTr = $('<tfoot><tr><td>&nbsp;</td><td><button class="tec-save">Submit</button></td><td>&nbsp;</td><td>&nbsp;</td></tr></tfoot>');
        this.$element.append($saveTr);
    };

    Plugin.prototype.addEventHandlers = function() {
        this.$element.on('click', 'td.tec-data-cell, td.tec-data-cell > *', this.selectCell);
        this.$element.on('click', 'button.tec-select-all', this.selectColumn.bind(this));
        this.$element.on('click', '.field-row-edit', this.toggleEditing.bind(this));
        this.$element.on('click', 'button.tec-save', this.save.bind(this));
    };

    function stop(event) {
        event.preventDefault();
        event.stopPropagation();
    }

    $.fn.tableEditCompare = function(options) {
        return this.each(function() {
            if (!$.data(this, 'plugin_' + pluginName)) {
                $.data(this, 'plugin_' + pluginName, new Plugin(this, options));
            }
        });
    };
})(jQuery);
